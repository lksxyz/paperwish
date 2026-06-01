# Sui Intent Agent — Sui Overflow Hackathon 2026

> **Last updated:** 2026-05-31 — Clarified product direction (chat app + SDK)

## Concept

An AI-powered autonomous agent wallet on Sui that lets users express financial goals in plain English, parses intent into a Programmable Transaction Block (PTB), runs a guardian risk check, and executes only after explicit user confirmation. Combines **Sub-track 2 (Autonomous Agent Wallet)** and **Sub-track 3 (Intent Engine)** into one cohesive project.

**Product:** Chat app as the end-user product (conversational UI, immediate use), SDK for developers who understand programming.

**Inspiration:** AgentaOS's guardian-wallet + Agentokratia Settlement Protocol (authorize→capture pattern), but built natively on Sui using zkLogin, Move policy objects, and PTBs.

---

## AgentaOS Research Summary

[AgentaOS](https://github.com/AgentaOS/agentaos) = "The financial OS for autonomous agents" on EVM:
- **Threshold signing (MPC)** — distributed signing, private key never reconstructed
- **Policy engine v2** — rules-based guardrails: spending limits, slippage protection, MEV protection, block infinite approvals
- **Sub-accounts** — create/import/switch agent wallets (`agenta sub create/switch`)
- **x402 payment protocol** — agent-to-agent payments
- **MCP server** — AI agent tool integration (Claude, LangChain, Vercel AI SDK)
- **Supported chains** — Ethereum, Base, Arbitrum, Optimism, Polygon

**Key insight from Agentokratia:** two-phase payments (authorize first, capture later) maps perfectly to Move policy objects with expiry — the policy *is* the authorization hold, and execution only happens within the policy constraints.

| AgentaOS (EVM) | Sui Intent Agent (Sui) |
|---|---|
| Threshold signing (MPC) | zkLogin + Move policy objects |
| Policy engine (rules-based guardrails) | Guardian layer (slippage, concentration risk) |
| Sub-accounts | AgentWallet + BudgetPolicy objects |
| x402 payments | Intent engine (future: agent-to-agent) |
| MCP server | AI agent tool integration via MCP |
| Spend limits, protocol whitelist | Move policy: cap, allowed_protocols, expires_at |

---

## Product Direction

### Chat App (primary — end user facing)
- Conversational UI for expressing financial goals in plain English
- Guardian risk display before execution
- Policy configuration UI
- Activity log viewer
- One-click revoke

### SDK (secondary — for developers)
- `@sui-intent-sdk` — reusable intent parser, guardian, PTB compiler
- Embedded by other apps to use the intent engine
- MCP server for AI agent integration (future)

---

## Architecture

```
User: "invest $500 in best yield on Sui for 30 days"
 │
        ▼
┌─────────────────────┐
│  Intent Parser (NL) │ ← converts natural language to structured intent
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│   Guardian Layer     │  ← catches risks in plain English
│ │  ← slippage, pool depth, smart contract risk
└─────────────────────┘
        │
        ▼  (user confirms)
┌─────────────────────┐
│   PTB Compiler │  ← compiles intent into Sui PTB
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│   Agent Wallet      │  ← zkLogin identity + Move policy object
│   (self-enforced)   │  ← policy: max N USDC, Deepbook only, expires 24h
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│  On-chain Log       │  ← every action logged as Move object (immutable)
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│  Execution │  ← real Deepbook orders, real yield positions
│ Owner Revocation   │  ← owner can revoke at any time
└─────────────────────┘
```

---

## Sui Primitives Used

| Component | Sui Primitive | Why |
|-----------|--------------|-----|
| Agent Identity | `zkLogin` | Passwordless, no private key management for AI agent |
| Budget Policy | `Move policy object` | Self-enforcing ceiling — can't exceed cap |
| Scope Control | `Move policy object` | "Deepbook only" — whitelisted protocols only |
| Expiry | `Move policy object` | Auto-revokes after configured time |
| Activity Log | `Move object` + events | Immutable on-chain audit trail |
| Execution | `PTB` | Atomic multi-step transactions |
| Routing/Swaps | `Deepbook` | Sui's native DEX |

---

## Sub-track Coverage

### Sub-track 2: Autonomous Agent Wallet ✓
- zkLogin for agent identity
- Move policy object with budget cap + protocol scope + expiry
- Real Deepbook orders executed autonomously
- On-chain activity log (every action as Move object)
- Owner revocation demo (one-click revoke)

### Sub-track 3: Intent Engine ✓
- Text → PTB → execution flow
- Human-readable PTB preview (plain English)
- Guardian catching at least 2 risk classes (slippage + concentration)
- Explicit confirmation step before execution

---

## What to Build (48h scope)

### Phase 1 — Core Agent Wallet

**Move contracts:**
- `AgentWallet` — holds agent identity via zkLogin
- `BudgetPolicy` — self-enforcing policy object:
  ```move
  struct BudgetPolicy has key, store {
    id: UID,
    cap: u64,                    // max USDC allowed
    allowed_protocols: Vec<ID>, // whitelist of protocol IDs
    expires_at: u64,             // unix timestamp expiry
    owner: address,              // who can revoke
  }
  ```
- `ActivityLog` — emitted event object for every action
- `revoke_agent()` — owner-facing revocation function

**Frontend:**
- zkLogin flow for agent identity
- Policy configuration UI (set cap, scope, expiry)
- Activity log viewer
- Revoke button

### Phase 2 — Intent Engine

**Intent Parser:**
- Regex/LLM-based natural language → structured intent
- Examples: "invest $500 in best yield for 30 days" → `Intent { action: Invest, amount: 500, asset: USDC, duration: 30d }`

**Guardian Layer:**
- Risk checker (at least 2 classes):
  - **Slippage risk** — pool depth analysis
  - **Concentration risk** — TVL in single pool
- Plain-English risk summary displayed to user

**PTB Compiler:**
- Intent → Sui PTB (multi-step: swap → deposit → position object)
- Preview rendered in plain English before signing

### Phase 3 — Deepbook Integration

- Real swap orders via Deepbook
- Real yield routing across Sui DeFi

---

## Features to Build

### Must-have (48h)
1. **Guardian Layer** — catch 2+ risk classes (slippage, pool depth, smart contract risk) in plain English
2. **Policy enforcement** — Move policy objects that are self-enforcing (can't exceed cap, "Deepbook only", expires 24h)
3. **Intent Parser** — NL → structured intent → PTB preview in plain English
4. **One-click revoke** — owner can revoke agent at any time

### Nice-to-have (if time permits)
1. **MCP server** — AI agents (Claude, etc.) interact with the intent engine
2. **Sub-account creation** — UI to create multiple agent wallets with different policies
3. **x402-style payments** — agent-to-agent payment support
4. **Policy templates** — "conservative", "moderate", "aggressive" presets

---

## Competitive Landscape

### Direct Competitors on Sui

| Project | What it does | How we're different |
|---------|-------------|---------------------|
| **Beep** (by Mysten Labs) | World's first agentic wallet + finance protocol on Sui. Conversational UI, smart money you can talk to, agentic treasury, a402 protocol. | Beep is the "Stripe of agentic economy" — we focus on **intent engine + guardian risk layer** with user-controlled policy objects. Different angle: Beep = payments infrastructure, ours = user-safe intent execution |
| **Talus Nexus** | AI agents as Sui objects. Nexus framework for autonomous agents in DeFi/gaming/DAOs. | Talus enables AI agent *creation* — we enable AI agent *control* (budget policy, risk guardian, one-click revoke) |
| **Sui AI Agent Kit** (MCP) | Node.js MCP server bridging AI agents to Sui. | We're a consumer-facing *app* with guardian risk checks + PTB preview, not just tooling |
| **Nautilus** | TEE-based verifiable AI computations on Sui. | Nautilus = privacy compute layer; we sit on top — parsing user intent, checking risks, executing PTBs |

### Indirect / Narrative Competitors

| Project | Chain | Relevance |
|---------|-------|-----------|
| **AgentaOS** | EVM (Base, Eth) | Inspiration — we port the *pattern* (guardrails + authorize→capture) to Sui |
| **Openfort** | EVM | AI agent wallet with spend limits, policy controls |
| **Cobo** | Multi-chain | Agentic wallet guide, not Sui-specific |
| **ChainGPT Pad** | Multi-chain | AI agent launchpad — different focus |

### Key Market Signals

- **Sui AI ecosystem:** $150M+ invested, 1.5M AI nodes via DePIN, partnerships with Google (AP2), Amazon AWS
- **Agentic finance trend:** Beep launched Nov 2025 as Sui's first agentic wallet — market is nascent, not crowded
- **Sui Overflow 2025:** 599 submissions, AI track — AI x Sui is hot
- **x402 protocol:** Open protocol for AI agent payments (compatible with MCP, A2A, AP2) — we're aligned with this standard

### Our Differentiation

**vs Beep:** Beep = "Stripe of agentic economy" (fast payments, no safety net). We = "Guardian of agentic finance" (human confirmation + risk check before execution). If you tell Beep "invest $500", it just does it. We show "this pool has 40% slippage, 60% TVL concentration — are you sure?"

**vs Talus:** Talus = developer infrastructure to build AI agents. We = end-user app to control AI agents (budget policy, risk guardian, one-click revoke).

**Execution flow comparison:**

```
Beep:   Human → "invest $500" → execute (no safety net)
Talus:  Developer → build AI agent → deploy
Us:     Human → "invest $500" → Guardian risk check → PTB preview → confirm → execute
```

**Core differentiator:** The confirmation step + plain-English risk summary is the "wow moment" in our demo. User types a goal, sees risks, clicks confirm, real transaction happens — visible, compelling, and uniquely safe.

**4 key differentiators:**
1. **Guardian Layer** — no one else on Sui does plain-English risk summary + user confirmation
2. **Move policy objects** — self-enforcing budget cap + protocol scope + expiry (Sui-native advantage)
3. **Intent → PTB preview** — user sees exactly what will happen on-chain before signing
4. **Chat app + SDK dual product** — end users get immediate value, devs get extensibility

---

## Why This Wins

1. **Hits both sub-tracks** with one project
2. **Sui-native throughout** — zkLogin, Move policy objects, PTBs, Deepbook (not just "Sui as a payment rail bolted on")
3. **AgentaOS-inspired but Sui-native architecture** — proven pattern adapted to Sui's strengths
4. **Chat app + SDK** — immediate use for users, extensible for developers
5. **Excellent demo story** — "tell me what to do with $500" → agent shows risks → user approves → real transactions happen on-chain
6. **Object-based positions** — Sui's model makes vault positions natively composable (LP positions as objects, not ERC-20 tokens)
7. **Early mover** — Beep just launched, market is nascent, no Sui-native intent engine with guardian layer exists yet

---

## Tech Stack

- **Move** — smart contracts (agent wallet, policy, activity log)
- **TypeScript** — frontend (Next.js)
- **Sui SDK** — chain interaction
- **zkLogin** — agent identity
- **Deepbook** — swap execution
- **LLM API** — intent parsing (optional, can be regex-based for hackathon)

---

## Project Structure

```
paperwish/
├── packages/
│   ├── chat-app/          # Next.js chat UI (end user app)
│   └── intent-sdk/        # TypeScript SDK (intent parser, guardian, PTB compiler)
├── move/                  # Move smart contracts
│   ├── sources/
│   │   ├── agent_wallet.move
│   │   ├── budget_policy.move
│   │   ├── activity_log.move
│   │   └── revocation.move
│   └── Move.toml
└── README.md
```

---

## Team Strengths Needed

- 1 Move developer — wallet contracts, policy objects, PTB compilation
- 1 frontend — chat UI, guardian layer display, activity log
- 1 AI/UX — natural language parsing, risk analysis

---

## References

### AgentaOS (Inspiration)
- [AgentaOS (github.com/AgentaOS/agentaos)](https://github.com/AgentaOS/agentaos)
- [AgentaOS guardian-wallet](https://github.com/agentaos/guardian-wallet)
- [AgentaOS commerce-payments (Agentokratia)](https://github.com/agentaos/commerce-payments)

### Sui AI Stack
- [Beep — Sui's first agentic wallet](https://justbeep.it/)
- [Sui AI Stack](https://www.sui.io/ai)
- [Sui AI Agent Kit (MCP)](https://mcp.umin.ai/server/sui-ai-agent-toolkit)
- [Talus Nexus](https://talus.io/)
- [Nautilus — TEE-based verifiable AI](https://docs.sui.io/concepts/ nautilus)
- [Walrus — decentralized blob storage](https://docs.sui.io/concepts/walrus)

### Sui Core Docs
- [Sui zkLogin docs](https://docs.sui.io/concepts/zklogin)
- [Sui Programmable Transaction Blocks](https://docs.sui.io/concepts/transaction-prog-ptb)
- [Deepbook](https://docs.sui.io/concepts/deepbook)
- [Sui Move policy objects](https://docs.sui.io/concepts/object-policy)

### Market Research
- [NOX Ventures — AI Landscape on Sui 2025](https://medium.com/@NOX_Ventures/ai-landscape-on-sui-2025-edition-1a5a57f681ef)
- [ChainCatcher — Sui Ecosystem AI Panorama 2025](https://www.chaincatcher.com/en/article/2225271)
- [Sui Overflow 2026 Hackathon](https://overflow.sui.io/)
