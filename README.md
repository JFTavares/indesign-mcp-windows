# InDesign MCP para Windows

> **Uso por sua conta e risco.** Cada usuário é responsável pelas operações executadas, pelos backups e pela revisão dos resultados. Leia o [aviso de responsabilidade](#aviso-de-responsabilidade) antes de usar.

Automação editorial com inteligência artificial para Adobe InDesign no Windows, uma iniciativa da **[Booknando](https://booknando.com.br/)**.

A Booknando oferece **serviços e tecnologia para editoras**, combinando experiência em produção editorial com desenvolvimento de ferramentas que ajudam a melhorar a qualidade, a acessibilidade e a eficiência dos processos. Trabalhamos com livros digitais, EPUB, acessibilidade editorial e soluções para os desafios de produção das editoras.

Este MCP faz parte desse compromisso: aproximar a inteligência artificial das ferramentas que as equipes editoriais já utilizam, automatizando tarefas no InDesign e reduzindo trabalho repetitivo.

**Sua editora precisa de serviços de produção digital ou de tecnologia para o fluxo editorial? [Conheça a Booknando e fale com nossa equipe](https://booknando.com.br/).**

Adaptação do [lucdesign/indesign-mcp-server](https://github.com/lucdesign/indesign-mcp-server), mantendo os nomes e as 51 ferramentas do original. A comunicação com o InDesign usa **COM + Windows PowerShell + ExtendScript**, no lugar de AppleScript. Licença MIT original preservada em `LICENSE`.

O teste de integração incluído cria um documento, texto, estilo, cor, camada, retângulo e tabela, salva INDD, exporta PDF e reabre o documento. As demais ferramentas foram portadas, mas nem todas as suas combinações de opções foram verificadas no aplicativo.

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

## Claude Desktop e Claude Cowork

### Instalar no Claude Desktop para Windows

1. Conclua a instalação deste projeto e abra o InDesign.
2. No Claude Desktop, abra **Settings > Developer > Edit Config** para localizar `claude_desktop_config.json`. O caminho usual no Windows é `%APPDATA%\Claude\claude_desktop_config.json`; prefira abrir pelo aplicativo.
3. Adicione a entrada `indesign` de `config/mcp.windows.json` dentro de `mcpServers`. Preserve os servidores que já estiverem configurados. Para uma configuração nova, use o arquivo gerado inteiro.
4. Encerre completamente o Claude Desktop e abra-o novamente. Confira se o servidor `indesign` está disponível nas ferramentas da conversa.
5. Peça: **“Use get_document_info do MCP indesign para consultar o documento ativo.”**

Exemplo — substitua os caminhos pelos da sua instalação:

```json
{
  "mcpServers": {
    "indesign": {
      "command": "C:/Program Files/nodejs/node.exe",
      "args": ["C:/Projects/indesign-mcp-windows/index.js"],
      "env": {
        "INDESIGN_PROGID": "InDesign.Application",
        "INDESIGN_TIMEOUT_MS": "60000",
        "INDESIGN_ALLOW_ARBITRARY_CODE": "0"
      }
    }
  }
}
```

Referência: [guia oficial de conexão de servidores MCP locais](https://modelcontextprotocol.io/docs/develop/connect-local-servers).

### Usar com Claude Cowork: disponibilidade e limites

**A configuração do Desktop acima não garante que o servidor apareça no Cowork.** A documentação de conectores da Anthropic informa que servidores adicionados por `claude_desktop_config.json` não ficam disponíveis no Cowork. Já a documentação de arquitetura descreve suporte a MCPs de plugins locais em determinadas implantações desktop. São mecanismos diferentes, e este repositório fornece um servidor stdio, sem pacote de plugin ou extensão MCPB para Cowork.

Para usar esta versão com Claude, siga o procedimento do **Claude Desktop com MCP local**. Caso o servidor não apareça na sessão do Cowork, use a conversa do Desktop que disponibilize as ferramentas locais. A integração específica com Cowork permanece não validada; não há instalação direta de Cowork oferecida nesta versão.

O servidor precisa executar no Windows com acesso ao InDesign. Ele não fornece uma URL HTTP para a tela de conectores remotos e não pode ser iniciado dentro da VM Linux do Cowork usando o Node Linux.

Referências: [conectores remotos e limites dos MCPs locais](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp) e [arquitetura do Cowork](https://support.claude.com/en/articles/14479288-claude-cowork-architecture-overview).

## Instalar no Hermes Agent

Use o **Hermes nativo para Windows**, no mesmo computador e usuário do InDesign. Se ainda não o tiver, siga o [guia oficial de instalação no Windows](https://hermes-agent.nousresearch.com/docs/user-guide/windows-native). Conclua também a instalação deste MCP descrita acima.

1. Abra o `config.yaml` do Hermes. O instalador nativo usa normalmente `%LOCALAPPDATA%\hermes\config.yaml`. Se houver `HERMES_HOME` personalizado, use o arquivo dessa pasta.
2. Adicione `indesign` ao bloco `mcp_servers`, preservando as demais entradas e ajustando os caminhos:

```yaml
mcp_servers:
  indesign:
    command: "C:/Program Files/nodejs/node.exe"
    args:
      - "C:/Projects/indesign-mcp-windows/index.js"
    timeout: 90
    connect_timeout: 15
    supports_parallel_tool_calls: false
    env:
      INDESIGN_PROGID: "InDesign.Application"
      INDESIGN_TIMEOUT_MS: "60000"
      INDESIGN_ALLOW_ARBITRARY_CODE: "0"
```

3. Reinicie o Hermes e abra uma conversa com `hermes chat`.
4. Peça: **“Use o MCP indesign para consultar o documento ativo.”** O Hermes descobre as ferramentas na conexão; os nomes recebem o prefixo `mcp_indesign_`.

Este exemplo requer Node e MCP executando no Windows nativo. Não use o Node Linux de WSL, Docker ou de um servidor remoto para iniciar esta ponte COM. A configuração segue a [documentação MCP do Hermes](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp/); a integração ponta a ponta com o Hermes ainda não foi validada por este projeto.

## Outros clientes MCP

Use o objeto `mcpServers.indesign` gerado em `config/mcp.windows.json` na configuração do cliente que aceite esse formato. Para preenchimento manual, escolha **STDIO**, indique o executável Node em `command` e passe o caminho absoluto de `index.js` como único argumento.

O cliente inicia e encerra o servidor. `npm.cmd start` também o inicia, mas ele ficará aguardando mensagens MCP em stdin; isso é esperado. Logs são enviados para stderr para não contaminar o protocolo.

## Usar

Exemplo de pedido ao assistente conectado:

> Crie um documento A4 de duas páginas no InDesign. Adicione um título em Arial e um quadro de texto com conteúdo em português. Salve em uma pasta que eu indicar e exporte um PDF.

As posições e dimensões são em milímetros quando indicado no esquema. Índices de páginas e quadros começam em **zero**. A maioria das ferramentas trabalha no documento ativo: evite alternar documentos enquanto uma operação estiver em execução.

### Margens de documentos e páginas

`create_document` aplica as margens ao padrão do documento, às páginas-mestre e a todas as páginas criadas. Assim, páginas adicionadas depois também herdam as margens das páginas-mestre, em vez de voltarem ao padrão de 12,7 mm.

Com `facingPages: false`, `marginLeft` e `marginRight` significam esquerda e direita. Com `facingPages: true`, significam **interna** e **externa**: o InDesign faz o espelhamento automaticamente. Por exemplo, `marginLeft: 30` e `marginRight: 11` produzem 30 mm à esquerda no recto e 30 mm à direita no verso. Não inverta esses valores manualmente em `page.marginPreferences` nas páginas pares.

`get_document_info` separa o padrão do documento das margens efetivas de cada página, informa os valores em milímetros e sinaliza diferenças. Em páginas opostas, mostra tanto esquerda/direita físicas quanto interna/externa. O padrão do documento sozinho não comprova que as guias das páginas estejam corretas. A correção em `create_document` vale para novos documentos; arquivos existentes precisam ter suas margens conferidas por página.

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
npm.cmd run test:indesign:margins # regressão de margens com documentos temporários
```

O teste de integração exige que não haja documentos abertos. Ele usa arquivos novos, fecha somente o documento criado por ele e grava `results.json`, INDD e PDF na pasta de sua execução. Os testes de geração verificam a sintaxe das 51 ferramentas, não todas as propriedades da API do InDesign.

O teste específico `test:indesign:margins` pode ser executado com documentos abertos: cria e fecha apenas documentos temporários e restaura o documento ativo. Verifica margens de páginas e páginas-mestre, herança em páginas novas, guias espelhadas criadas pelo próprio InDesign e divergências no relatório, inclusive com unidades de visualização diferentes.

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

## Aviso de responsabilidade

**Este software é utilizado por conta, risco e responsabilidade de cada usuário.** É fornecido no estado em que se encontra, sem garantias expressas ou implícitas, conforme a [licença MIT](LICENSE), incluindo garantias de funcionamento ininterrupto, ausência de erros, adequação a uma finalidade específica ou precisão dos resultados.

O MCP permite que agentes de inteligência artificial executem operações no InDesign. Comandos incorretos, interpretações equivocadas ou falhas de execução podem modificar, sobrescrever ou excluir conteúdo e arquivos. A confirmação de uma operação pelo agente não substitui a avaliação do usuário.

Cabe ao usuário:

- Manter backups atualizados e testar as automações em cópias dos documentos antes de utilizá-las em produção.
- Revisar os comandos, as permissões concedidas e os resultados antes de salvar, exportar, publicar ou entregar materiais.
- Proteger informações confidenciais e verificar quais dados são compartilhados com os agentes e serviços de IA utilizados.
- Obter as autorizações e licenças necessárias para os documentos, imagens, fontes, softwares e demais recursos envolvidos.

**Na máxima extensão permitida pela legislação aplicável, a Booknando, os autores, os titulares dos direitos autorais e os colaboradores não se responsabilizam por perdas de dados, alterações ou corrupção de arquivos, interrupções de trabalho, lucros cessantes ou outros danos decorrentes do uso ou da impossibilidade de uso deste software.**

A disponibilização deste projeto open source não inclui compromisso de suporte, manutenção, disponibilidade ou correção de falhas. Serviços profissionais eventualmente contratados com a Booknando seguem os termos do respectivo contrato.

Este aviso complementa a licença MIT, sem alterar suas permissões nem afastar direitos ou responsabilidades que não possam ser excluídos pela legislação aplicável. O texto integral da licença está em [LICENSE](LICENSE).

## Licença e contribuições

Código aberto sob a [licença MIT](LICENSE). Projeto original por [lucdesign](https://github.com/lucdesign/indesign-mcp-server); adaptação Windows por [Jose Fernando Tavares](https://github.com/JFTavares), da [Booknando](https://booknando.com.br/). Este projeto é independente e não é um produto oficial da Adobe. O Adobe InDesign é um aplicativo proprietário e precisa ser instalado e licenciado separadamente.

Problemas e melhorias podem ser enviados pelas [issues](https://github.com/JFTavares/indesign-mcp-windows/issues) ou por pull requests. Inclua a versão do Windows, Node e InDesign, os passos para reproduzir e logs sem dados pessoais. Antes de enviar uma alteração, execute `npm.cmd test`; mudanças na integração COM devem ser verificadas também com o InDesign.

A publicação é do código-fonte no GitHub. O pacote mantém `private: true` para evitar publicação acidental no npm; isso não altera a licença MIT nem a visibilidade pública do repositório.
