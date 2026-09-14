# Tags compartilhadas por processo modelado

As tags pertencem a um processo modelado e são associadas às suas requisições. Renomear uma tag altera sua apresentação em todas as requisições associadas, inclusive encerradas, com impacto explicitado ao usuário e registro de quem alterou o quê e quando.

Essa fronteira permite manter uma classificação consistente entre requisições do mesmo processo, preservando a independência entre processos diferentes. Tags locais por requisição evitariam alterações coletivas, mas não atenderiam à renomeação compartilhada desejada; um catálogo único do ambiente propagaria alterações além do processo pretendido.

O catálogo é compartilhado entre versões do mesmo processo no mesmo ambiente. Além de remover uma associação individual, é possível excluir a tag do processo, removendo todas as suas associações após avisar o usuário sobre o alcance da exclusão.
