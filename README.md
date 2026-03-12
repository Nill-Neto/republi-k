# Republi-K 🏠

**Republi-K** é um sistema completo e moderno para gestão de moradias compartilhadas (repúblicas, colivings e apartamentos divididos). Ele simplifica o controle financeiro, a organização de tarefas e a convivência entre os moradores, trazendo transparência para o dia a dia da casa.

## 🚀 Principais Funcionalidades

- **Gestão Financeira Transparente**: Controle de despesas coletivas e individuais, com cálculo automático de rateio (divisão igualitária ou baseada em percentuais/pesos).
- **Controle de Pagamentos**: Envio de comprovantes de pagamento de rateio e pendências diretamente pela plataforma, com fluxo de aprovação exclusivo para administradores.
- **Despesas Recorrentes**: Configuração de contas fixas mensais (aluguel, internet, condomínio, etc.) que são geradas automaticamente a cada ciclo.
- **Cartões de Crédito**: Organização de despesas pessoais parceladas por faturas e cartões de crédito.
- **Estoque e Compras**: Controle de itens de uso comum e listas de compras colaborativas para mercado e manutenção.
- **Ferramentas de Convivência**: Mural de avisos interativo, regras da casa definidas pelo grupo e sistema de votações para decisões democráticas.
- **Prestação de Contas**: Geração de relatórios mensais detalhados em formatos PDF e CSV.
- **Dashboards Dinâmicos**: Visões separadas para a casa, gastos pessoais e uma visão gerencial para administradores acompanharem a inadimplência.

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React 18 com Vite e TypeScript
- **Estilização**: Tailwind CSS, shadcn/ui (Radix UI) e Framer Motion (para animações)
- **Roteamento**: React Router Dom v6
- **Gerenciamento de Estado & Dados**: TanStack Query v5 (React Query)
- **Backend & Autenticação**: Supabase (PostgreSQL, Storage para comprovantes e documentos, Edge Functions e OAuth)
- **Visualização de Dados**: Recharts
- **Formulários e Validação**: React Hook Form integrado com Zod

## 📁 Estrutura do Projeto

O projeto segue uma arquitetura baseada em features e boas práticas de React moderno:

- `/src/components`: Componentes reutilizáveis, divididos entre componentes base de UI (`/ui`), layout (`/layout`) e lógicas específicas de negócio (`/dashboard`, `/onboarding`).
- `/src/contexts`: Gerenciamento de estado global da aplicação (ex: `AuthContext` com gerenciamento de sessão e perfil do usuário ativo).
- `/src/pages`: Páginas da aplicação mapeadas pelo roteador.
- `/src/hooks`: Custom hooks para abstração de lógica complexa (ex: `useCycleDates` para lidar com as datas de fechamento e vencimento de despesas).
- `/src/integrations/supabase`: Cliente do Supabase e as tipagens estritas geradas a partir do banco de dados relacional.
- `/src/lib`: Funções utilitárias (ex: formatação monetária, máscaras de CPF).
- `/supabase`: Configurações de infraestrutura do backend, Edge Functions (ex: envio de emails e PDF gen) e migrações SQL.

## ⚙️ Pré-requisitos

- **Node.js** (versão 18 ou superior recomendada)
- Um gerenciador de pacotes: npm, yarn, pnpm ou bun
- Uma conta no [Supabase](https://supabase.com/) contendo o schema de tabelas e as Edge Functions do projeto devidamente configuradas.

## 🚀 Como executar o projeto localmente

1. **Clone o repositório:**
   ```bash
   git clone <URL_DO_REPOSITORIO>
   cd <NOME_DA_PASTA>
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```
   A aplicação será iniciada com suporte a hot-reload, normalmente disponível na porta `8080` (ex: `http://localhost:8080`).

## 🔑 Variáveis de Ambiente

As principais integrações necessitam da configuração correta do ambiente (via `.env` localmente ou configurado na plataforma de hospedagem). Exemplo:

```env
VITE_APP_URL="http://localhost:8080"
# (As credenciais do Supabase podem ser parametrizadas via variáveis em ambientes de produção)
```

## 🏗️ Build para Produção

Para gerar a versão de produção otimizada:
```bash
npm run build
```
Os artefatos estáticos serão gerados na pasta `/dist`, prontos para serem hospedados em plataformas como Vercel, Netlify ou Render.