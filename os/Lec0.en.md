# Lec0 Course Introduction

## Goals
- Understand grading rules and lab workflow
- Review the role of operating systems in computer systems
- Build the core perspective: resource management + abstraction interface

## What Is an Operating System?
An operating system is the layer between hardware and applications. It is responsible for:

1. Managing CPU, memory, storage, and network resources
2. Providing unified and easy-to-use system call interfaces
3. Ensuring correctness and isolation under concurrency

> In one sentence: OS turns complex hardware into a programmable and sharable platform.

:::remark 📝 Class Note
User mode prevents applications from directly touching privileged hardware states,
while kernel mode executes privileged instructions and exposes controlled services via system calls.
:::

:::tip 💡 Tip
Before running labs, verify your toolchain (`gcc`, `gdb`, `make`) first.
It usually saves a lot of setup/debug time.
:::

:::warn ⚠️ Warning
For concurrent programs, do not trust a single run.
Run multiple times and inspect timing-related logs to catch race conditions.
:::

:::error ⛔ Common Error
Executing privileged operations directly in user space may trigger exceptions.
Use system calls to request kernel services instead.
:::

## Week 1 Tasks
- Set up the lab environment
- Learn `fork / exec / wait` semantics
- Read Chapters 1-2 of the textbook

## LaTeX Formula Example
- Inline formula: scheduler utilization can be expressed as $U = 1 - p^n$.
- Display formula:

$$R_{avg} = \frac{1}{N}\sum_{i=1}^{N} (T_{completion,i} - T_{arrival,i})$$

## Summary
Next lectures will focus on scheduling, virtual memory, file systems, and synchronization.
