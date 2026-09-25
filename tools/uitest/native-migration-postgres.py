"""Run ONLY on a disposable copy of a Septem integration database."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import sys
if not os.environ.get('PGDATABASE','').startswith('native_migration_test_'):
    sys.exit('Use PGDATABASE=native_migration_test_* (cópia descartável).')
spec=importlib.util.spec_from_file_location('migration',Path(__file__).parents[1]/'maintenance/migrate-native-forms.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
state=m.snapshot()
assert state['executions'], 'O teste exige requisições reais no banco descartável.'
# Restore legacy-shaped fixtures only in this copy, retaining all answer paths.
for form in state['forms']:
 native=form['SchemaJson']
 if isinstance(native,str):native=json.loads(native)
 if native.get('format')!='septem-native':continue
 components=[]
 for tab in native['tabs']:
  for group in tab['groups']:
   children=[]
   for field in group['fields']:
    f=dict(field.get('config',{}));f.update(id=field['id'],type=field['type'],label=field['label'])
    if field['kind']=='field':f['key']=field['key']
    children.append(f)
   g=dict(group.get('config',{}));g.update(id=group['id'],label=group['label'],type='dynamiclist' if group['type']=='table' else 'group',components=children)
   if group['type']=='table':g['key']=group['key']
   components.append(g)
 legacy=dict(id=native['id'],type='default',components=components)
 raw=m.canonical(legacy)
 m.query(f'UPDATE flow_forms SET "SchemaJson"={m.sql_value(raw)}::jsonb,"SchemaHash"={m.sql_value(m.digest(legacy))} WHERE "Id"={form["Id"]};')
 for flow in state['flows']:
  if flow['FormId']==form['Id']:
   xml=m.rewrite_xml(flow['BpmnXml'],legacy)
   m.query(f'UPDATE flows SET "BpmnXml"={m.sql_value(xml)} WHERE "Id"={flow["Id"]};')
# Independent fixtures were deduplicated across process keys by the test factory.
# Split those fixtures during setup to exercise the supported per-process path.
setup=m.snapshot()
for form in setup['forms']:
 links=[f for f in setup['flows'] if f['FormId']==form['Id']]
 keys=sorted({f['Key'] for f in links})
 for process in keys[1:]:
  legacy=copy.deepcopy(form['SchemaJson'])
  if isinstance(legacy,str):legacy=json.loads(legacy)
  legacy['id']='migration_'+__import__('hashlib').sha256(process.encode()).hexdigest()[:24]
  raw=m.canonical(legacy)
  new_id=int(m.query(f'INSERT INTO flow_forms ("SchemaJson","SchemaHash","CreatedAt") VALUES ({m.sql_value(raw)}::jsonb,{m.sql_value(m.digest(legacy))},now()) RETURNING "Id";'))
  for flow in links:
   if flow['Key']==process:
    xml=m.rewrite_xml(flow['BpmnXml'],legacy)
    m.query(f'UPDATE flows SET "FormId"={new_id},"BpmnXml"={m.sql_value(xml)} WHERE "Id"={flow["Id"]};')
before=m.snapshot();plan=m.make_plan(before)
assert not plan['blocked'], plan['blocked']
assert plan['converted']
stale=copy.deepcopy(plan);stale['state']['hashes']['flow_executions']='stale'
try:
 m.query(m.build_sql(stale));raise AssertionError('Plano desatualizado aceito')
except RuntimeError as error:assert 'Inventário divergiu' in str(error)
assert m.snapshot()==before
m.query(m.build_sql(plan))
after=m.snapshot()
for table,h in before['hashes'].items():
 if table not in {'flows','flow_forms'}:assert after['hashes'][table]==h,table
assert before['executions']==after['executions']
assert [(f['Id'],f['Key'],f['FormId']) for f in before['flows']]==[(f['Id'],f['Key'],f['FormId']) for f in after['flows']]
assert not m.make_plan(after)['converted']
assert not m.make_plan(after)['blocked']
print(f"PASSOU: {len(plan['converted'])} snapshots convertidos, {len(after['executions'])} requisições preservadas, vínculos e demais tabelas intactos, rollback de plano desatualizado e reexecução sem conversões.")
