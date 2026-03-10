# Lec2 Predicate Logic and Quantifiers

## Goals
- Understand predicates, objects, and quantifiers
- Learn variable scope and binding
- Formalize natural-language statements

## Quantifier Basics
- Universal quantifier: $\forall x\, P(x)$
- Existential quantifier: $\exists x\, P(x)$

Formalization examples:

- "Every student submits homework": $\forall x\,(Student(x) \to Submit(x))$
- "Some student submitted homework": $\exists x\,(Student(x) \land Submit(x))$

:::remark 📝 Class Note
Changing quantifier order often changes meaning.
$\forall x\exists y\,R(x,y)$ is usually not equivalent to $\exists y\forall x\,R(x,y)$.
:::

## Negation Rules
Display formula:

$$
\neg\forall x\,P(x) \equiv \exists x\,\neg P(x)
$$

## Summary
Predicate logic increases expressiveness by modeling objects and properties directly.
