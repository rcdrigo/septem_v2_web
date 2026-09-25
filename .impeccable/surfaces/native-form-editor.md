# Editor estrutural de formulários nativos

Modo: Operate. Extensão do modelador existente, conforme RF07–RF11 e CA04–CA06. Administradores montam um rascunho pela hierarquia Aba → Agrupamento → Campo. A persistência é a da E1. Não converter nem limpar formulários antigos nesta entrega.

## Direction contract

THESIS: tornar inequívoco o destino de cada campo, por seleção e catálogo contextual. A criação não depende de arrastar.

OWN-WORLD: preservar a interface clara do modelador: superfícies white/slate-50, texto slate-900, bordas slate-200/300, cantos discretos e ícones Lucide. Não há mudança de identidade visual.

STORY: começar com aba e grupo prontos, criar estruturas, escolher tipos, editar propriedades e salvar o processo.

FIRST VIEWPORT: barra de abas acima do canvas; grupos empilhados com ação Adicionar campo no cabeçalho; propriedades à direita. O grupo selecionado recebe borda escura. Em telas estreitas, propriedades seguem o canvas no mesmo scroll.

FORM: extensão prescrita pelo desenho confirmado, sem sorteio de conceitos. Controles HTML e diálogo do projeto, com foco visível, teclado e estados vazios explícitos.

FINISH: revisão visual e funcional do editor, evidências desktop/mobile e registro da entrega. Preservar o sistema visual existente e os arquivos de contexto não relacionados.

**Continuidade visual verificada.** A E2 preserva as superfícies brancas/slate, bordas discretas, tipografia de sistema e ícones Lucide do modelador, conforme `NativeFormEditor`, `FieldConfigPanel`, `FormularioView`, os controles compartilhados `Field`/`IconButton` e `globals.css`. As evidências `../review/native-editor-desktop.png`, `../review/native-editor-mobile.png` e `../review/native-editor-mobile-properties.png` confirmam seleção destacada e propriedades à direita no desktop e abaixo do canvas no mobile; a revisão independente aprovou este recorte sem achados materiais. O registro limita-se à extensão estrutural E2, sem mudança de identidade ou asset raster embarcado; não estabelece um sistema global, não supre o `DESIGN.md` ausente e não certifica execução ou integrações de etapas posteriores.
