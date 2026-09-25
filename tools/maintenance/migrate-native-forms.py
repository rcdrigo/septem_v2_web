#!/usr/bin/env python3
"""Conversão manual e conservadora de snapshots legados; nunca remove requisições."""
import argparse
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import uuid
import xml.etree.ElementTree as ET

# Connection helpers only; no cleanup operation is invoked.
spec = importlib.util.spec_from_file_location('connection', Path(__file__).with_name('postgres_tools.py'))
connection = importlib.util.module_from_spec(spec)
spec.loader.exec_module(connection)
query, rows, sql_value = connection.query, connection.rows, connection.sql_value
NS = 'http://septem.app/schema/1.0/bpmn'
FIELDS = {'textfield', 'textarea', 'number', 'datetime', 'filepicker', 'select', 'radio', 'checkbox', 'checklist', 'taglist'}
PRESENTATIONS = {'text', 'html', 'image', 'separator', 'spacer'}
RESERVED = {'__proto__', 'constructor', 'prototype'}

def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':'), allow_nan=False)

def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()

def convert(schema, scope):
    if not isinstance(schema, dict): raise ValueError('Schema deve ser um objeto JSON.')
    if schema.get('format') == 'septem-native':
        return copy.deepcopy(schema)
    if schema.get('type') != 'default' or not isinstance(schema.get('components'), list):
        raise ValueError('Schema legado não reconhecido (esperado type=default e components).')
    allowed_root = {'type', 'id', 'components', 'schemaVersion', 'exporter', 'executionPlatform', 'executionPlatformVersion'}
    if set(schema) - allowed_root:
        raise ValueError('Configurações de raiz precisam de revisão: ' + ', '.join(sorted(set(schema) - allowed_root)))
    ids, keys = set(), set()
    def identity(old, path):
        token = f'key/{old["key"]}' if old.get('key') else path
        value = old.get('id') or str(uuid.uuid5(uuid.NAMESPACE_URL, f'septem:{scope}:{token}'))
        if not isinstance(value, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', value) or value in RESERVED or value in ids:
            raise ValueError(f'{path}: identidade inválida ou repetida: {value}')
        ids.add(value)
        return value
    def key(value, path):
        if not isinstance(value, str) or not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]{0,119}', value) or value in RESERVED or value in keys:
            raise ValueError(f'{path}: chave inválida ou repetida: {value}')
        keys.add(value)
        return value
    def node(old, path):
        label = old.get('label', '')
        if not isinstance(label, str) or len(label) > 240:
            raise ValueError(f'{path}: rótulo incompatível.')
        config = {k: copy.deepcopy(v) for k,v in old.items() if k not in {'id','label','type','key','components'}}
        # Runtime maps visible to automationHidden; preserve the effective legacy flag.
        if 'automationHidden' in config:
            config['visible'] = not bool(config.pop('automationHidden'))
        result = dict(id=identity(old, path), label=label)
        if config: result['config'] = config
        return result
    def field(old, path, table=False):
        kind = old.get('type')
        if 'components' in old or kind not in FIELDS | PRESENTATIONS or (table and kind in PRESENTATIONS):
            raise ValueError(f'{path}: tipo/estrutura sem conversão automática: {kind}')
        result = node(old, path)
        result.update(kind='field' if kind in FIELDS else 'presentation', type=kind)
        if kind in FIELDS: result['key'] = key(old.get('key'), path)
        elif old.get('key'): raise ValueError(f'{path}: apresentação com chave exige revisar respostas/referências.')
        return result
    def group(old, path):
        kind = old.get('type')
        if kind not in {'group', 'dynamiclist'} or not isinstance(old.get('components'), list):
            raise ValueError(f'{path}: agrupamento inválido.')
        if kind == 'group' and old.get('key'):
            raise ValueError(f'{path}: grupo com chave exige revisar referências.')
        result = node(old, path)
        result['type'] = 'table' if kind == 'dynamiclist' else 'group'
        if kind == 'dynamiclist': result['key'] = key(old.get('key'), path)
        result['fields'] = [field(v, f'{path}/{i}', kind == 'dynamiclist') for i,v in enumerate(old['components'])]
        return result
    result = dict(format='septem-native', schemaVersion=1, id=identity(schema, 'form'), tabs=[])
    loose = []
    def append_tab(groups, label, path):
        result['tabs'].append(dict(id=identity({}, path), label=label, groups=groups))
    def flush():
        if loose:
            index = len(result['tabs'])
            g = dict(id=identity({}, f'loose/{index}'), label='Geral', type='group', fields=list(loose))
            append_tab([g], 'Geral', f'tab/{index}')
            loose.clear()
    for i, old in enumerate(schema['components']):
        if old.get('type') in {'group', 'dynamiclist'}:
            flush()
            g = group(old, f'component/{i}')
            append_tab([g], g['label'] or 'Geral', f'tab/{len(result["tabs"])}')
        else:
            loose.append(field(old, f'component/{i}'))
    flush()
    if not result['tabs']:
        append_tab([dict(id=identity({}, 'empty'), label='Grupo 1', type='group', fields=[])], 'Aba 1', 'tab/0')
    return result

def check_answers(definition, answers):
    """Reject data that a later native save would discard. Never filter during migration."""
    if not isinstance(answers, dict): raise ValueError('Respostas não são um objeto JSON.')
    scalar, tables = set(), {}
    for tab in definition['tabs']:
        for group in tab['groups']:
            fields = {f['key'] for f in group['fields'] if f['kind'] == 'field'}
            if group['type'] == 'table': tables[group['key']] = fields
            else: scalar |= fields
    unknown = set(answers) - scalar - set(tables)
    if unknown: raise ValueError('Respostas sem campo definido: ' + ', '.join(sorted(unknown)))
    for key, columns in tables.items():
        if key not in answers: continue
        value = answers[key]
        if not isinstance(value, list) or any(not isinstance(row, dict) or set(row)-columns for row in value):
            raise ValueError(f'Tabela {key}: linhas/colunas não representáveis sem perda.')

def rewrite_xml(xml, definition, original=None):
    for _, ns in ET.iterparse(__import__('io').StringIO(xml), events=['start-ns']):
        if not re.fullmatch(r'ns\d+', ns[0]): ET.register_namespace(ns[0], ns[1])
    root = ET.fromstring(xml)
    targets = [e for e in root.iter() if e.tag in {f'{{{NS}}}formSchema',f'{{{NS}}}FormSchema'}]
    if len(targets) != 1: raise ValueError('BPMN deve conter exatamente um formSchema; revisar snapshot.')
    if original is not None and json.loads(targets[0].text or 'null') != original:
        raise ValueError('BPMN diverge do snapshot de formulário; revisar antes de converter.')
    targets[0].text = canonical(definition)
    return ET.tostring(root, encoding='unicode')

def snapshot():
    identity = rows("SELECT current_database() AS database, current_user AS username, coalesce(inet_server_addr()::text,'local socket') AS host, inet_server_port() AS port, oid FROM pg_database WHERE datname=current_database()")[0]
    tables = [r['tablename'] for r in rows("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")]
    required = {'flows','flow_forms','flow_executions'}
    if not required <= set(tables): raise ValueError('Banco não contém o schema de ambiente Septem.')
    # Full row hashes detect concurrent changes and prove preservation of untouched records.
    hashes = {t: query('SELECT md5(coalesce(string_agg(v,\'\' ORDER BY v),\'\')) FROM (SELECT md5(row_to_json(r)::text) v FROM "'+t.replace('"','""')+'" r) s;') for t in tables}
    forms = rows('SELECT * FROM flow_forms ORDER BY "Id"')
    flows = rows('SELECT "Id", "Key", "FormId", "BpmnXml" FROM flows ORDER BY "Id"')
    executions = rows('SELECT "Id", "FlowId", "FormData" FROM flow_executions ORDER BY "Id"')
    stable = {}
    for table, removed in {'flows': ['BpmnXml'], 'flow_forms': ['SchemaJson', 'SchemaHash']}.items():
        expression = 'row_to_json(r)::jsonb' + ''.join(' - ' + sql_value(c) for c in removed)
        stable[table] = query('SELECT md5(coalesce(string_agg(v,\'\' ORDER BY v),\'\')) FROM (SELECT md5((' + expression + ')::text) v FROM "'+table+'" r) s;')
    return dict(identity=identity, hashes=hashes, stable=stable, forms=forms, flows=flows, executions=executions)

def make_plan(state):
    converted, updates, blocked = {}, [], []
    for form in state['forms']:
        schema = form['SchemaJson']
        if isinstance(schema,str): schema=json.loads(schema)
        if schema.get('format') == 'septem-native': continue
        links = [f for f in state['flows'] if f['FormId']==form['Id']]
        scopes = sorted({f['Key'] for f in links})
        try:
            if len(scopes)>1: raise ValueError('Snapshot compartilhado por processos diferentes; revisar identidade.')
            definition=convert(schema, scopes[0] if scopes else f'orphan/{form["Id"]}')
            linked_ids={f['Id'] for f in links}
            for execution in state['executions']:
                if execution['FlowId'] in linked_ids:
                    data=execution['FormData']
                    if isinstance(data,str): data=json.loads(data)
                    check_answers(definition, data if data is not None else {})
            xmls=[dict(id=f['Id'],xml=rewrite_xml(f['BpmnXml'],definition,schema)) for f in links]
            converted[str(form['Id'])]=definition
            updates.extend(xmls)
        except (ValueError, TypeError, KeyError, ET.ParseError) as error:
            blocked.append(dict(formId=form['Id'],processes=scopes,reason=str(error)))
    for flow in state['flows']:
        if flow['FormId'] is not None: continue
        try:
            root = ET.fromstring(flow['BpmnXml'])
            embedded = [e for e in root.iter() if e.tag in {f'{{{NS}}}formSchema', f'{{{NS}}}FormSchema'} and (e.text or '').strip()]
            if embedded:
                blocked.append(dict(flowId=flow['Id'], reason='BPMN com formulário sem vínculo FormId; reconciliar antes de converter.'))
        except ET.ParseError:
            blocked.append(dict(flowId=flow['Id'], reason='BPMN inválido; revisar antes de converter.'))
    hashes = {}
    for form in state['forms']:
        schema = converted.get(str(form['Id']))
        value = digest(schema) if schema else form['SchemaHash']
        if value in hashes:
            blocked.append(dict(formId=form['Id'],reason=f'Conversão produz snapshot duplicado com {hashes[value]}; revisar deduplicação sem perder vínculos.'))
        hashes[value] = form['Id']
    return dict(version=1,state=state,converted=converted,flows=updates,blocked=blocked)

def build_sql(plan):
    if plan['blocked']: raise ValueError('Há bloqueios no plano; nenhuma conversão será aplicada.')
    state=plan['state']
    quoted=lambda t:'"'+t.replace('"','""')+'"'
    sql=['BEGIN;',"SET LOCAL lock_timeout='10s';", 'LOCK TABLE '+','.join(quoted(t) for t in state['hashes'])+' IN ACCESS EXCLUSIVE MODE;']
    def checks(hashes):
        expressions=[]
        for table,value in hashes.items():
            expressions.append('(SELECT md5(coalesce(string_agg(v,\'\' ORDER BY v),\'\')) FROM (SELECT md5(row_to_json(r)::text) v FROM '+quoted(table)+' r) s) IS DISTINCT FROM '+sql_value(value))
        return 'DO '+sql_value("BEGIN IF "+' OR '.join(expressions)+" THEN RAISE EXCEPTION 'Inventário divergiu; transação cancelada'; END IF; END")+';'
    sql.append(checks(state['hashes']))
    for form_id,definition in plan['converted'].items():
        raw=canonical(definition)
        sql.append(f'UPDATE flow_forms SET "SchemaJson"={sql_value(raw)}::jsonb,"SchemaHash"={sql_value(hashlib.sha256(raw.encode()).hexdigest())} WHERE "Id"={int(form_id)};')
    for flow in plan['flows']:
        sql.append(f'UPDATE flows SET "BpmnXml"={sql_value(flow["xml"])} WHERE "Id"={int(flow["id"])};')
    sql.append(checks({t:h for t,h in state['hashes'].items() if t not in {'flows','flow_forms'}}))
    conditions = []
    for table, removed in {'flows': ['BpmnXml'], 'flow_forms': ['SchemaJson', 'SchemaHash']}.items():
        expression = 'row_to_json(r)::jsonb' + ''.join(' - ' + sql_value(c) for c in removed)
        conditions.append('(SELECT md5(coalesce(string_agg(v,\'\' ORDER BY v),\'\')) FROM (SELECT md5((' + expression + ')::text) v FROM "'+table+'" r) s) IS DISTINCT FROM '+sql_value(state['stable'][table]))
    for form_id, definition in plan['converted'].items():
        conditions.append(f'NOT EXISTS (SELECT 1 FROM flow_forms WHERE "Id"={int(form_id)} AND "SchemaJson"={sql_value(canonical(definition))}::jsonb AND "SchemaHash"={sql_value(digest(definition))})')
    for flow in plan['flows']:
        conditions.append(f'NOT EXISTS (SELECT 1 FROM flows WHERE "Id"={int(flow["id"])} AND "BpmnXml"={sql_value(flow["xml"])})')
    sql.append('DO '+sql_value("BEGIN IF "+' OR '.join(conditions)+" THEN RAISE EXCEPTION 'Conferência da conversão falhou'; END IF; END")+';')
    sql.append('COMMIT;')
    return '\n'.join(sql)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    sub=parser.add_subparsers(dest='command',required=True)
    p=sub.add_parser('plan');p.add_argument('--output',required=True)
    a=sub.add_parser('apply');a.add_argument('--plan',required=True)
    args=parser.parse_args()
    try:
        if args.command=='plan':
            plan=make_plan(snapshot())
            out=Path(args.output).resolve();out.mkdir(mode=0o700,parents=True,exist_ok=False)
            target=out/'plan.json';target.write_text(json.dumps(plan,ensure_ascii=False,indent=2));target.chmod(0o600)
            print(json.dumps(dict(target=plan['state']['identity'],convert=len(plan['converted']),blocked=plan['blocked']),ensure_ascii=False,indent=2))
            print(f'Plano: {target}. Nenhum registro alterado.')
            return 1 if plan['blocked'] else 0
        path=Path(args.plan).resolve();plan=json.loads(path.read_text())
        current=snapshot()
        # Never execute edited mappings; recompute the entire deterministic plan.
        fresh=make_plan(current)
        if canonical(plan)!=canonical(fresh): raise ValueError('Plano alterado ou banco diferente/desatualizado. Gere novo plano.')
        script=build_sql(fresh)
        if not fresh['converted']: print('Nenhum snapshot legado para converter.');return 0
        database=current['identity']['database']
        if not sys.stdin.isatty(): raise ValueError('Use um terminal interativo para confirmar.')
        if input(f'Aplicação e workers devem estar parados. Digite CONVERTER {database}: ')!=f'CONVERTER {database}': raise ValueError('Cancelado.')
        backup=path.parent/'before-migration.dump'
        with backup.open('xb') as handle:
            backup.chmod(0o600)
            subprocess.run([connection.executable('pg_dump'),'-w','--format=custom','--no-owner','--no-acl'],stdout=handle,check=True,env=connection.client_environment())
        output=path.parent/'applied.sql';output.write_text(script);output.chmod(0o600)
        query(script)
        print('Conversão concluída. Requisições, respostas, versões, anexos, históricos e automações preservados. Valide o fluxo antes de reabrir o acesso.')
        return 0
    except (ValueError, RuntimeError, OSError, KeyError, subprocess.CalledProcessError) as error:
        print(f'Erro: {error}',file=sys.stderr);return 1

if __name__=='__main__': sys.exit(main())
