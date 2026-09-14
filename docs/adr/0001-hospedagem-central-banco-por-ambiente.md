# Hospedagem central com banco por ambiente

A plataforma deve criar ambientes para clientes, incluindo vários ambientes de um mesmo cliente com dados próprios. Adotamos hospedagem central e aplicação compartilhada, com um banco separado por ambiente: essa escolha mantém a operação da aplicação centralizada e separa os dados de cada ambiente.

Instalações nos servidores dos clientes ficam fora deste escopo. Em comparação com uma aplicação dedicada por ambiente, compartilhamos a operação da aplicação; em comparação com um banco compartilhado, assumimos o custo de provisionar e manter vários bancos. Migrações e recuperação de dados precisarão considerar cada banco individualmente.
