"""Authentication reuse across multiple migration queries and the backup process."""
import importlib.util
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('pg', Path(__file__).parents[1]/'maintenance/postgres_tools.py')
pg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pg)

class AuthenticationTests(unittest.TestCase):
    def setUp(self):
        pg._password = None
        pg._password_prompted = False

    def test_configured_credentials_do_not_prompt(self):
        with patch('shutil.which', return_value='psql'), patch('getpass.getpass') as prompt, patch('subprocess.run', return_value=subprocess.CompletedProcess([], 0, 'ok', '')):
            self.assertEqual(pg.query('SELECT 1;'), 'ok')
            prompt.assert_not_called()

    def test_wrong_password_does_not_loop(self):
        missing = subprocess.CompletedProcess([], 2, '', 'fe_sendauth: no password supplied')
        wrong = subprocess.CompletedProcess([], 2, '', 'FATAL: password authentication failed')
        with patch('shutil.which', return_value='psql'), patch('sys.stdin.isatty', return_value=True), patch('getpass.getpass', return_value='test-invalid') as prompt, patch('subprocess.run', side_effect=[missing, wrong]) as run:
            with self.assertRaises(RuntimeError): pg.query('SELECT 1;')
            self.assertEqual(prompt.call_count, 1)
            self.assertEqual(run.call_count, 2)

    def test_noninteractive_missing_password_fails_without_prompt(self):
        with patch('shutil.which', return_value='psql'), patch('sys.stdin.isatty', return_value=False), patch('getpass.getpass') as prompt, patch('subprocess.run', return_value=subprocess.CompletedProcess([], 2, '', 'fe_sendauth: no password supplied')):
            with self.assertRaises(RuntimeError): pg.query('SELECT 1;')
            prompt.assert_not_called()

    def test_prompt_once_across_queries(self):
        failure = subprocess.CompletedProcess([], 2, '', 'fe_sendauth: no password supplied')
        success = subprocess.CompletedProcess([], 0, 'ok\n', '')
        with patch('shutil.which', return_value='psql'), patch('sys.stdin.isatty', return_value=True), patch('getpass.getpass', return_value='test-only-secret') as prompt, patch('subprocess.run', side_effect=[failure, success, success]) as run:
            self.assertEqual(pg.query('SELECT 1;'), 'ok')
            self.assertEqual(pg.query('SELECT 2;'), 'ok')
            self.assertEqual(prompt.call_count, 1)
            for call in run.call_args_list[1:]:
                self.assertIn('-w', call.args[0])
                self.assertEqual(call.kwargs['env']['PGPASSWORD'], 'test-only-secret')
                self.assertNotIn('test-only-secret', str(call.args))
            self.assertEqual(pg.client_environment()['PGPASSWORD'], 'test-only-secret')

    def test_non_authentication_failure_does_not_prompt(self):
        with patch('shutil.which', return_value='psql'), patch('getpass.getpass') as prompt, patch('subprocess.run', return_value=subprocess.CompletedProcess([], 1, '', 'ERROR: relation missing')):
            with self.assertRaises(RuntimeError): pg.query('SELECT broken;')
            prompt.assert_not_called()

if __name__ == '__main__': unittest.main()
