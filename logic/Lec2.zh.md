# Lec2 谓词逻辑与量词

## 本讲目标
- 理解谓词、个体与量词
- 掌握量词作用域与变元约束
- 学会将自然语言句子形式化

## 量词基础
- 全称量词：$\forall x\, P(x)$
- 存在量词：$\exists x\, P(x)$

形式化示例：

- “所有学生都交作业”：$\forall x\,(Student(x) \to Submit(x))$
- “有学生交了作业”：$\exists x\,(Student(x) \land Submit(x))$

:::remark 📝 课堂备注
量词位置变化会改变语义，
如 $\forall x\exists y\,R(x,y)$ 与 $\exists y\forall x\,R(x,y)$ 通常不等价。
:::

## 等价与否定
块公式示例：

$$
\neg\forall x\,P(x) \equiv \exists x\,\neg P(x)
$$

## 小结
谓词逻辑让我们能表达“对象及其性质”，表达能力显著强于命题逻辑。
