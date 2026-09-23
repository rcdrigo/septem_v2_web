import json
import shutil
import subprocess

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

