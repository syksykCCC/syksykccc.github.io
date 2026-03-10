# Lec1 Foundations of Propositional Logic

## Goals
- Understand propositions and compound propositions
- Learn common connectives and truth tables
- Practice basic logical equivalence transformations

## Propositions and Connectives
Common connectives:

- Negation: $\neg p$
- Conjunction: $p \land q$
- Disjunction: $p \lor q$
- Implication: $p \to q$
- Biconditional: $p \leftrightarrow q$

:::remark 📝 Class Note
Symbolic representation is more precise than natural language in formal reasoning,
which helps avoid ambiguity and enables mechanical checking.
:::

:::tip 💡 Study Tip
Build truth tables by hand first, then memorize identities.
You will understand equivalence faster.
:::

## Formula Example
Inline formula: $\neg(p \land q) \equiv (\neg p) \lor (\neg q)$.

Display formula:

$$
(p \to q) \equiv (\neg p \lor q)
$$

:::warn ⚠️ Warning
Do not interpret implication as causality. It is a truth-functional definition.
:::

:::error ⛔ Common Error
Remember: $p \to q$ is false only when $p$ is true and $q$ is false.
:::

## Summary
Propositional logic is the base layer for predicate logic and proof systems.
