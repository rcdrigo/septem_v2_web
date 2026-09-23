#!/usr/bin/env python3
"""Manual, tenant-local reset. Uses PostgreSQL's PG* environment/.pgpass, never a hardcoded target."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import uuid
import xml.etree.ElementTree as ET

NS = 'http://septem.app/schema/1.0/bpmn'
# Only these tables may be deleted. Users, secrets, catalogues and templates never enter the plan.
PURGE = ['flow_execution_message_deliveries', 'flow_execution_message_mentions',
         'flow_execution_messages', 'flow_execution_field_changes', 'flow_task_alert_dispatch',
         'flow_execution_form_values', 'flow_execution_actions', 'flow_execution_tags',
         'flow_execution_tag_events', 'flow_execution_tag_states', 'document_signatures',
         'document_codes', 'flow_execution_tasks', 'flow_executions',
         'form_script_test_runs', 'form_script_tests', 'form_script_revisions', 'form_scripts', 'form_fields', 'form_field_groups', 'forms']
PROTECTED = ['users', 'access_profiles', 'org_units', 'document_templates', 'data_sources', 'process_tags']

def executable(name):
    path = shutil.which(name)
    if not path:
        raise RuntimeError(f'{name} não encontrado. Instale as ferramentas cliente do PostgreSQL e adicione-as ao PATH.')
    return path

def sql_value(value):
    return "'" + str(value).replace("'", "''") + "'"

def query(sql):
    result = subprocess.run([executable('psql'), '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], input="SET standard_conforming_strings=on; SET search_path=public,pg_catalog;\n" + sql,
                            text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError('Falha no PostgreSQL. Confira PGHOST, PGPORT, PGDATABASE, PGUSER e .pgpass.\n' + result.stderr)
    return result.stdout.strip()

def rows(sql):
    return json.loads(query(f"SELECT coalesce(json_agg(q), '[]'::json) FROM ({sql}) q;") or '[]')

def snapshot(include_history):
    identity = rows("SELECT current_database() AS database, current_user AS username, coalesce(inet_server_addr()::text, 'local socket') AS host, inet_server_port() AS port, oid FROM pg_database WHERE datname=current_database()")[0]
    tables = {r['table_name'] for r in rows("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")}
    if not {'flows', 'flow_forms', 'flow_executions', 'users'} <= tables:
        raise RuntimeError('Este banco não contém o schema de um ambiente Septem. Nada foi alterado.')
    flows = rows('SELECT f."Id", f."Key", f."Version", f."BpmnXml", f."FormId" FROM flows f JOIN flow_forms s ON s."Id"=f."FormId" WHERE s."SchemaJson"->>\'format\' IS DISTINCT FROM \'septem-native\' ORDER BY f."Id"')
    purge = [t for t in PURGE if t in tables]
    if include_history and 'document_executions' in tables:
        purge.insert(0, 'document_executions')
    counts = {t: int(query(f'SELECT count(*) FROM "{t}";')) for t in purge}
    protected = {t: int(query(f'SELECT count(*) FROM "{t}";')) for t in PROTECTED if t in tables}
    history = int(query('SELECT count(*) FROM document_executions;')) if 'document_executions' in tables else 0
    # Retain all answer URLs in the private manifest before deleting the answers.
    answers = rows('SELECT "Id", "FormData" FROM flow_executions ORDER BY "Id"')
    # FK review fails closed if a new module references a deleted table outside this inventory.
    fks = rows("SELECT conrelid::regclass::text AS child, confrelid::regclass::text AS parent FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace")
    unexpected = [f for f in fks if f['parent'] in purge and f['child'] not in purge]
    if unexpected:
        raise RuntimeError('Dependências novas fora do inventário: ' + json.dumps(unexpected) + '. Revise o procedimento antes de limpar.')
    return dict(identity=identity, flows=flows, counts=counts, protected=protected, history=history, answers=answers)

def empty_definition(form_id):
    return dict(format='septem-native', schemaVersion=1, id=form_id,
                tabs=[dict(id=str(uuid.uuid4()), label='Aba 1', groups=[dict(id=str(uuid.uuid4()), label='Grupo 1', type='group', fields=[])])])

def reset_xml(xml, definition):
    for _, ns in ET.iterparse(io.StringIO(xml), events=['start-ns']):
        if not ns[0].startswith('ns'): ET.register_namespace(ns[0], ns[1])
    root = ET.fromstring(xml)
    process = next((e for e in root.iter() if e.tag.endswith('}process')), None)
    if process is None:
        raise RuntimeError('BPMN sem processo: corrija antes de gerar o plano.')
    ext = next((e for e in process if e.tag.endswith('}extensionElements')), None)
    if ext is None:
        ext = ET.SubElement(process, '{http://www.omg.org/spec/BPMN/20100524/MODEL}extensionElements')
    for parent in list(root.iter()):
        for child in list(parent):
            if child.tag in [f'{{{NS}}}formSchema', f'{{{NS}}}FormSchema']:
                parent.remove(child)
    ET.SubElement(ext, f'{{{NS}}}formSchema').text = json.dumps(definition, ensure_ascii=False, separators=(',', ':'))
    for element in root.iter():
        if element.tag in [f'{{{NS}}}processConfig', f'{{{NS}}}ProcessConfig']:
            element.set('status', 'draft')
    # Keep declarative references for deliberate correction in the modeler. Publishing is blocked until resolved.
    return ET.tostring(root, encoding='unicode')

def fingerprint(state):
    return hashlib.sha256(json.dumps(state, sort_keys=True).encode()).hexdigest()

def plan(args):
    state = snapshot(args.include_document_history)
    if state['history'] and not args.include_document_history:
        raise RuntimeError(f"Há {state['history']} registros de geração de documentos sem vínculo de execução confiável. Para incluir TODO esse histórico no lote (preservando modelos), repita com --include-document-history; caso queira preservá-lo, revise os payloads antes da limpeza.")
    out = Path(args.output).resolve()
    out.mkdir(mode=0o700, parents=True, exist_ok=False)
    per_process = {}
    replacements = []
    for flow in state['flows']:
        definition = per_process.setdefault(flow['Key'], empty_definition(str(uuid.uuid4())))
        replacements.append(dict(id=flow['Id'], definition=definition, xml=reset_xml(flow['BpmnXml'], definition)))
    payload = dict(version=1, fingerprint=fingerprint(state), state=state,
                   include_document_history=args.include_document_history, replacements=replacements)
    (out/'plan.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    os.chmod(out/'plan.json', 0o600)
    print(json.dumps(dict(target=state['identity'], remove=state['counts'], legacy_versions=len(state['flows']), preserve=state['protected']), ensure_ascii=False, indent=2))
    print(f'Plano privado: {out}/plan.json\nNenhum dado alterado. O plano contém respostas para inventário de anexos; guarde-o como um backup.')

def apply(args):
    path = Path(args.plan).resolve()
    payload = json.loads(path.read_text())
    current = snapshot(payload['include_document_history'])
    if fingerprint(current) != payload['fingerprint']:
        raise RuntimeError('O banco mudou ou o alvo é diferente do plano. Gere outro plano com a aplicação parada.')
    target = current['identity']['database']
    print(f'Alvo: {current["identity"]}. Remoção: {current["counts"]}. Versões legadas: {len(current["flows"])}.')
    if not sys.stdin.isatty():
        raise RuntimeError('A execução exige terminal interativo e confirmação manual.')
    if input(f'Pare a aplicação e os workers. Para confirmar, digite LIMPAR {target}: ') != f'LIMPAR {target}':
        raise RuntimeError('Cancelado. Nenhum dado alterado.')
    backup = path.parent/'before-reset.dump'
    if backup.exists():
        raise RuntimeError('Já existe um backup neste diretório. Gere um novo plano.')
    with backup.open('xb') as handle:
        os.chmod(backup, 0o600)
        subprocess.run([executable('pg_dump'), '--format=custom', '--no-owner', '--no-acl'], stdout=handle, check=True)
    script = build_sql(payload)
    (path.parent/'applied.sql').write_text(script)
    os.chmod(path.parent/'applied.sql', 0o600)
    query(script)
    after = snapshot(payload['include_document_history'])
    if any(after['counts'].values()) or after['flows'] or current['protected'] != after['protected']:
        raise RuntimeError('Conferência final divergiu. Mantenha a aplicação parada e examine o backup e applied.sql.')
    (path.parent/'result.json').write_text(json.dumps(dict(target=after['identity'], removed=current['counts'], after=after['counts'], protected=after['protected']), indent=2))
    print('Limpeza do banco concluída e conferida. Processos afetados estão em rascunho com formulário nativo vazio. Corrija referências e publique pelo modelador.\nOs objetos de storage NÃO foram apagados: use plan.json para identificar anexos e excluir somente objetos sem referências restantes.')

def build_sql(payload):
    state = payload['state']
    locks = sorted(set(state['counts']) | {'flows', 'flow_forms', 'flow_form_fields', 'flow_task_form_fields'})
    sql = ['BEGIN;', 'SET LOCAL lock_timeout = \'10s\';', 'LOCK TABLE ' + ', '.join('"'+t+'"' for t in locks) + ' IN ACCESS EXCLUSIVE MODE;']
    # Verify inside the lock, so concurrent changes after the preview cannot silently enter this deletion.
    checks = [f'(SELECT count(*) FROM "{t}") <> {count}' for t,count in state['counts'].items()]
    for answer in state['answers']:
        raw = answer['FormData']
        if isinstance(raw, str): raw = json.loads(raw)
        value = 'NULL' if raw is None else sql_value(json.dumps(raw)) + '::jsonb'
        checks.append(f'NOT EXISTS (SELECT 1 FROM flow_executions WHERE \"Id\"={answer["Id"]} AND \"FormData\" IS NOT DISTINCT FROM {value})')
    for flow in state['flows']:
        checks.append(f'NOT EXISTS (SELECT 1 FROM flows WHERE "Id"={flow["Id"]} AND "BpmnXml"={sql_value(flow["BpmnXml"])} AND "FormId"={flow["FormId"]})')
    sql.append("DO " + sql_value("BEGIN IF " + ' OR '.join(checks) + " THEN RAISE EXCEPTION 'O banco mudou desde o plano'; END IF; END") + ";")
    if 'flow_execution_messages' in state['counts']:
        sql.append('UPDATE flow_execution_messages SET "RootMessageId"=NULL, "ReplyToMessageId"=NULL;')
    for table in state['counts']:
        sql.append(f'DELETE FROM "{table}";')
    for replacement in payload['replacements']:
        serialized = json.dumps(replacement['definition'], ensure_ascii=False, separators=(',', ':'))
        digest = hashlib.sha256(serialized.encode()).hexdigest()
        sql.append(f'INSERT INTO flow_forms ("SchemaJson", "SchemaHash", "CreatedAt") VALUES ({sql_value(serialized)}::jsonb,{sql_value(digest)},now()) ON CONFLICT ("SchemaHash") DO NOTHING;')
        sql.append(f'UPDATE flows SET "FormId"=(SELECT "Id" FROM flow_forms WHERE "SchemaHash"={sql_value(digest)}), "Status"=\'draft\', "BpmnXml"={sql_value(replacement["xml"])}, "UpdatedAt"=now() WHERE "Id"={replacement["id"]};')
        sql.append(f'DELETE FROM flow_form_fields WHERE "FlowId"={replacement["id"]};')
    sql.append('DELETE FROM flow_forms WHERE "SchemaJson"->>\'format\' IS DISTINCT FROM \'septem-native\' AND NOT EXISTS (SELECT 1 FROM flows WHERE "FormId"=flow_forms."Id");')
    final_checks = [f'(SELECT count(*) FROM "{table}") <> 0' for table in state['counts']]
    final_checks += [f'(SELECT count(*) FROM "{table}") <> {count}' for table,count in state['protected'].items()]
    sql.append("DO " + sql_value("BEGIN IF " + ' OR '.join(final_checks) + " THEN RAISE EXCEPTION 'Conferência da limpeza falhou'; END IF; END") + ";")
    sql.append('COMMIT;')
    return '\n'.join(sql)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    preview = sub.add_parser('plan', help='Inventaria sem alterar dados')
    preview.add_argument('--output', required=True)
    preview.add_argument('--include-document-history', action='store_true')
    run = sub.add_parser('apply', help='Confirma, faz backup e executa o plano')
    run.add_argument('--plan', required=True)
    args = parser.parse_args()
    try:
        (plan if args.command == 'plan' else apply)(args)
    except (RuntimeError, subprocess.CalledProcessError, OSError, ValueError) as error:
        print(f'Erro: {error}', file=sys.stderr)
        return 1
    return 0

if __name__ == '__main__':
    sys.exit(main())
