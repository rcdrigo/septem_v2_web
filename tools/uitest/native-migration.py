"""Pure migration tests; emits a converted fixture for the real TypeScript contract."""
import copy
import importlib.util
import json
from pathlib import Path
import sys
import unittest
spec=importlib.util.spec_from_file_location('migration',Path(__file__).parents[1]/'maintenance/migrate-native-forms.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
SCHEMA=dict(type='default',id='Form_old',components=[
 dict(id='Group_1',type='group',label='Dados',components=[dict(id='Field_1',type='textfield',key='nome',label='Nome',validate={'required':True},properties={'septemEvents':'[]'})]),
 dict(id='Table_1',type='dynamiclist',key='itens',label='Itens',components=[dict(id='Field_2',type='number',key='quantidade',label='Quantidade'),dict(id='Field_3',type='checkbox',key='ativo',label='Ativo')])])
class MigrationTests(unittest.TestCase):
 def test_stable_preserved_config(self):
  a=m.convert(SCHEMA,'process');b=m.convert(SCHEMA,'process');self.assertEqual(a,b)
  self.assertEqual(a['tabs'][0]['groups'][0]['fields'][0]['id'],'Field_1')
  self.assertTrue(a['tabs'][0]['groups'][0]['fields'][0]['config']['validate']['required'])
  data={'nome':'Teste','itens':[{'quantidade':0,'ativo':False},{}]};before=copy.deepcopy(data)
  m.check_answers(a,data);self.assertEqual(before,data)
  self.assertEqual(m.convert(a,'process'),a)
 def test_missing_field_id_stable_after_reordering(self):
  old=dict(type='default',components=[dict(type='textfield',key='a'),dict(type='textfield',key='b')])
  first=m.convert(old,'p');old['components'].reverse();second=m.convert(old,'p')
  ids=lambda d:{f['key']:f['id'] for t in d['tabs'] for g in t['groups'] for f in g['fields']}
  self.assertEqual(ids(first),ids(second))
 def test_incompatible_never_discards(self):
  for field in [dict(type='dynamiclist',key='nested',components=[]),dict(type='button'),dict(type='textfield',key='nome')]:
   s=copy.deepcopy(SCHEMA);s['components'][1]['components'].append(field)
   with self.assertRaises(ValueError):m.convert(s,'process')
  for data in [{'extra':1},{'itens':[{'extra':1}]},{'itens':None}]:
   with self.assertRaises(ValueError):m.check_answers(m.convert(SCHEMA,'p'),data)
 def test_xml_preserves_status_and_references(self):
  xml='<b:definitions xmlns:b="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:s="http://septem.app/schema/1.0/bpmn"><b:process id="p"><b:extensionElements><s:processConfig status="published"/><s:formSchema>{}</s:formSchema><s:formFieldEntry fieldRef="nome"/></b:extensionElements></b:process></b:definitions>'
  out=m.rewrite_xml(xml,m.convert(SCHEMA,'p'))
  self.assertIn('status="published"',out);self.assertIn('fieldRef="nome"',out)
if __name__=='__main__':
 if len(sys.argv)>1 and sys.argv[1]=='--fixture':print(json.dumps(m.convert(SCHEMA,'process')))
 else:unittest.main()
