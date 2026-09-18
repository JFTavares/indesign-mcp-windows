# InDesign MCP para Windows

Adaptação do [lucdesign/indesign-mcp-server](https://github.com/lucdesign/indesign-mcp-server), mantendo os nomes e as 51 ferramentas do original. A comunicação com o InDesign usa **COM + Windows PowerShell + ExtendScript**, no lugar de AppleScript. Licença MIT original preservada em `LICENSE`.

**Testado neste computador com Adobe InDesign 2026 (21.6.0.57), interface em português, e Node.js 24.14.1.** O teste real cria um documento, texto, estilo, cor, camada, retângulo e tabela, salva INDD, exporta PDF e reabre o documento. As demais ferramentas foram portadas, mas nem todas as suas combinações de opções foram verificadas no aplicativo.

## Requisitos

- Windows 10/11 com sessão gráfica e InDesign desktop instalado, ativado e registrado para COM.
- Node.js 20 ou superior e npm.
- Windows PowerShell 5.1, incluído no Windows. Não requer Python, WSL, AppleScript ou módulos COM nativos para Node.
- Cliente MCP local com transporte stdio. Execute-o com o mesmo usuário e nível de elevação do InDesign.

Abra o InDesign uma vez e conclua eventuais telas de licença ou boas-vindas. A ponte tenta conectar à instância existente e, se necessário, inicia o aplicativo via COM.

## Instalar

Clone o repositório no PowerShell:

```powershell
git clone https://github.com/JFTavares/indesign-mcp-windows.git
cd indesign-mcp-windows
```

Dentro da pasta do projeto:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

O instalador baixa as dependências fixadas em `package-lock.json`, gera os exemplos de configuração com caminhos absolutos e executa os testes sem abrir o InDesign. O `Bypass` vale somente para esse processo, sem alterar a política global.

Alternativa manual:

```powershell
npm.cmd ci --ignore-scripts
node scripts/configure.js
npm.cmd test
npm.cmd run doctor
```

Os arquivos em `config/` são gerados na instalação com os caminhos do seu computador e não são versionados. Exemplos genéricos ficam em `examples/`.

## Conectar ao Codex

Copie o bloco de `config/codex.windows.toml` para `%USERPROFILE%\.codex\config.toml`. Se já existir `[mcp_servers.indesign]`, atualize esse bloco em vez de duplicá-lo. Reinicie a conexão MCP no cliente depois de salvar.

O exemplo usa `node.exe` e `index.js` com caminhos absolutos, além de um tempo limite do cliente maior que o da ponte. O formato está descrito na [documentação oficial de MCP do Codex](https://developers.openai.com/codex/mcp).

## Outros clientes MCP

Use o objeto `mcpServers.indesign` gerado em `config/mcp.windows.json` na configuração do cliente que aceite esse formato. Para preenchimento manual, escolha **STDIO**, indique o executável Node em `command` e passe o caminho absoluto de `index.js` como único argumento.

O cliente inicia e encerra o servidor. `npm.cmd start` também o inicia, mas ele ficará aguardando mensagens MCP em stdin; isso é esperado. Logs são enviados para stderr para não contaminar o protocolo.

## Usar

Exemplo de pedido ao assistente conectado:

> Crie um documento A4 de duas páginas no InDesign. Adicione um título em Arial e um quadro de texto com conteúdo em português. Salve em uma pasta que eu indicar e exporte um PDF.

As posições e dimensões são em milímetros quando indicado no esquema. Índices de páginas e quadros começam em **zero**. A maioria das ferramentas trabalha no documento ativo: evite alternar documentos enquanto uma operação estiver em execução.

Operações de fechamento, exclusão, salvamento com caminho e exportação exigem `confirmDestructive: true`, preservando a interface original. Esse campo deve refletir a autorização do usuário no cliente; o servidor não abre uma confirmação gráfica.

Para PDF, `HighQualityPrint`, `PressQuality` e `SmallestFileSize` reconhecem predefinições padrão em português e inglês. Também é possível passar o nome exato de uma predefinição instalada. `npm.cmd run doctor` lista esses nomes.

## Configuração por ambiente

| Variável | Padrão | Uso |
| --- | --- | --- |
| `INDESIGN_PROGID` | `InDesign.Application` | Para selecionar uma versão, use por exemplo `InDesign.Application.2026`. |
| `INDESIGN_TIMEOUT_MS` | `60000` | Tempo limite de cada execução COM, de 1000 a 1800000 ms. Ajuste também o limite do cliente. |
| `INDESIGN_ALLOWED_DIRS` | Pasta pessoal do usuário | Lista de pastas permitidas, separadas por **ponto e vírgula** no Windows. Quando definida, substitui o padrão. |
| `INDESIGN_ALLOW_ARBITRARY_CODE` | Desabilitado | `1` habilita `execute_indesign_code` para código ExtendScript de confiança. |

Exemplo de caminhos: `C:\Projetos;D:\Publicacoes`. As ferramentas de arquivo requerem caminhos absolutos. Caminhos com espaços e acentos são suportados; caminhos UNC, dispositivos e alternate data streams não são aceitos nesta versão. A validação resolve junctions/symlinks existentes antes de verificar a pasta permitida.

Este é um servidor de automação **local para clientes confiáveis**, não um sandbox de segurança. ExtendScript habilitado explicitamente pode acessar recursos do usuário; documentos abertos também podem ter vínculos externos. Execute somente uma instância do servidor por sessão do InDesign. A fila serializa comandos dentro de cada instância.

## Testes e diagnóstico

```powershell
npm.cmd test               # protocolo stdio, catálogo, geração de scripts, caminhos e ponte simulada
npm.cmd run doctor        # consulta real de versão e predefinições via COM
npm.cmd run test:indesign  # teste completo, gera arquivos em artifacts/
```

O teste de integração exige que não haja documentos abertos. Ele usa arquivos novos, fecha somente o documento criado por ele e grava `results.json`, INDD e PDF na pasta de sua execução. Os testes de geração verificam a sintaxe das 51 ferramentas, não todas as propriedades da API do InDesign.

Se houver falha:

- **COM não registrado:** abra/repare a instalação do InDesign e confira `INDESIGN_PROGID`.
- **Tempo esgotado:** feche diálogos e confira se o aplicativo ainda está ocupado. A ponte não repete automaticamente a operação; após um timeout, exige reiniciar o servidor. Interromper o PowerShell não garante interromper o script dentro do InDesign.
- **Funciona no terminal, falha no agente:** confirme se o cliente executa Node no Windows nativo, na sessão desktop, com acesso à automação COM. Um processo isolado pode não conseguir iniciar ou acessar o InDesign.
- **Acesso a arquivo negado:** confira caminhos absolutos e `INDESIGN_ALLOWED_DIRS`.
- **Fonte ou predefinição ausente:** use os nomes instalados no computador. Arial é a fonte padrão desta adaptação.

## Arquitetura e escopo

`index.js` mantém o catálogo e as rotinas do original. `lib/windows-bridge.js` cria arquivos temporários únicos, serializa execuções e interpreta o resultado UTF-8. `scripts/invoke-indesign.ps1` chama `Application.DoScript` com `ScriptLanguage.JAVASCRIPT`. `lib/paths.js` trata os caminhos do Windows.

Foram corrigidos também: captura de resultados em blocos condicionais, confirmação destrutiva que não bloqueava corretamente, texto com barras/aspas, Markdown incompatível com ExtendScript, leitura de documentos não salvos, criação/preenchimento de tabelas e exportação PDF. As preferências de interação e as preferências PDF são restauradas após a execução.

Ferramentas avançadas herdadas, como EPUB, empacotamento, data merge, preflight e tratamentos tipográficos, precisam de validação adicional com documentos representativos do seu fluxo. Esta entrega não afirma certificação de todas as opções nem compatibilidade testada com outras versões do InDesign.

Base estudada: commit `3e3f367634ff761455dcce06222b6e581fd8b7b3` do repositório original. A cópia em `upstream/` é apenas referência local e não faz parte do código distribuído. Veja `docs/PORTING.md` para as decisões técnicas.

## Licença e contribuições

Código aberto sob a [licença MIT](LICENSE). Projeto original por [lucdesign](https://github.com/lucdesign/indesign-mcp-server); adaptação Windows por [Jose Fernando Tavares](https://github.com/JFTavares). Este projeto é independente e não é um produto oficial da Adobe. O Adobe InDesign é um aplicativo proprietário e precisa ser instalado e licenciado separadamente.

Problemas e melhorias podem ser enviados pelas [issues](https://github.com/JFTavares/indesign-mcp-windows/issues) ou por pull requests. Inclua a versão do Windows, Node e InDesign, os passos para reproduzir e logs sem dados pessoais. Antes de enviar uma alteração, execute `npm.cmd test`; mudanças na integração COM devem ser verificadas também com o InDesign.

A publicação é do código-fonte no GitHub. O pacote mantém `private: true` para evitar publicação acidental no npm; isso não altera a licença MIT nem a visibilidade pública do repositório.
