"""Integration test of the real cleanup SQL; only runs in an explicitly disposable database."""
import importlib.util
import json
import os
from pathlib import Path
import sys
import uuid

if not os.environ.get('PGDATABASE', '').startswith('native_cleanup_test_'):
    sys.exit('PGDATABASE must begin with native_cleanup_test_ (disposable database only).')
spec = importlib.util.spec_from_file_location('reset', Path(__file__).parents[1]/'maintenance/reset-native-forms.py')
reset = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reset)
identity = reset.snapshot(True)['identity']
# Add a legacy snapshot and bind a disposable flow, preserving a copy of its XML.
flow = reset.rows('SELECT "Id", "BpmnXml" FROM flows ORDER BY "Id" LIMIT 1')[0]
legacy = '{"type":"default","components":[]}'
hash_value = uuid.uuid4().hex
reset.query(f'''INSERT INTO flow_forms ("SchemaJson", "SchemaHash", "CreatedAt") VALUES ({reset.sql_value(legacy)}::jsonb,{reset.sql_value(hash_value)},now());
UPDATE flows SET "FormId"=(SELECT "Id" FROM flow_forms WHERE "SchemaHash"={reset.sql_value(hash_value)}) WHERE "Id"={flow['Id']};''')
state = reset.snapshot(True)
replacements = []
by_key = {}
for old in state['flows']:
    definition = by_key.setdefault(old['Key'], reset.empty_definition(str(uuid.uuid4())))
    replacements.append(dict(id=old['Id'], definition=definition, xml=reset.reset_xml(old['BpmnXml'],definition)))
payload = dict(state=state, replacements=replacements)
# A stale inventory must roll back before any deletion.
stale = json.loads(json.dumps(payload))
stale['state']['counts']['flow_executions'] += 1
try:
    reset.query(reset.build_sql(stale))
    raise AssertionError('A stale plan was accepted')
except RuntimeError as error:
    assert 'O banco mudou desde o plano' in str(error), error
assert reset.snapshot(True) == state
# XML may contain quotes, backslashes and PostgreSQL dollar delimiters.
for replacement in payload['replacements']:
    replacement['xml'] += "<!-- quotes ' and dollars $$ and backslash \\ -->"
reset.query(reset.build_sql(payload))
after = reset.snapshot(True)
assert not any(after['counts'].values()), after['counts']
assert not after['flows']
assert after['protected'] == state['protected']
assert int(reset.query('SELECT count(*) FROM flow_forms WHERE "SchemaJson"->>\'format\'=\'septem-native\';')) > 0
print('PASSOU: limpeza transacional em banco descartável, formulários nativos, ausência de registros abrangidos e preservação de cadastros.')
