import getpass
import os
import sys
import json
import shutil
import subprocess

_password = None
_password_prompted = False

def client_environment():
    env = os.environ.copy()
    # Stable libpq diagnostics regardless of the Windows display language.
    env['LC_ALL'] = 'C'
    if _password is not None:
        env['PGPASSWORD'] = _password
    return env

def executable(name):
    path = shutil.which(name)
    if not path:
        raise RuntimeError(f'{name} não encontrado. Instale as ferramentas cliente do PostgreSQL e adicione-as ao PATH.')
    return path

def sql_value(value):
    return "'" + str(value).replace("'", "''") + "'"

def query(sql):
    global _password, _password_prompted
    command = [executable('psql'), '-X', '-w', '-qAt', '-v', 'ON_ERROR_STOP=1']
    statement = "SET standard_conforming_strings=on; SET search_path=public,pg_catalog;\n" + sql
    def run():
        return subprocess.run(command, input=statement, text=True, capture_output=True, env=client_environment())
    result = run()
    # Try configured credentials (.pgpass/PGPASSFILE/PGSERVICE/PGPASSWORD) first.
    # Retry only a missing-password connection failure, never a SQL failure.
    if result.returncode and 'no password supplied' in result.stderr.lower() and not _password_prompted and sys.stdin.isatty():
        _password_prompted = True
        try:
            _password = getpass.getpass('Senha do PostgreSQL (usada somente nesta execução): ')
        except EOFError as error:
            raise RuntimeError('Não foi possível ler a senha. Configure PGPASSFILE ou use um terminal interativo.') from error
        result = run()
    if result.returncode:
        raise RuntimeError('Falha no PostgreSQL. Confira PGHOST, PGPORT, PGDATABASE, PGUSER e o arquivo de senhas (pgpass.conf no Windows).\n' + result.stderr)
    return result.stdout.strip()

def rows(sql):
    return json.loads(query(f"SELECT coalesce(json_agg(q), '[]'::json) FROM ({sql}) q;") or '[]')

