# Lec4 - Abstractions 2: Files and I/O

## Learning Objectives
After this lecture, you should be able to explain the POSIX file abstraction, use both `FILE*` and file-descriptor APIs correctly, reason about buffering behavior, track kernel file state across `open/read/fork/close/dup`, and avoid common I/O correctness pitfalls.

## 1. POSIX File Abstraction

### 1.1 Core idea: **"Everything is a file"**
UNIX/POSIX uses one unified I/O interface for many resource types:
- Regular files on disk.
- Devices, such as terminals and printers.
- Networking endpoints, such as sockets.
- Local IPC endpoints, such as pipes and local sockets.

The canonical syscall surface is:
- `open()`
- `read()`
- `write()`
- `close()`

For resource-specific control that does not fit the generic interface, systems provide `ioctl()`.

### 1.2 What POSIX means
**POSIX = Portable Operating System Interface.**
It standardizes programmer-facing interfaces so software can be portable across Unix-like systems.

### 1.3 Files, metadata, directories, and paths
A file is a named data object in a file system.
- POSIX file data is a **sequence of bytes**.
- Metadata records properties such as size, owner, and modification time.

A directory is a naming container.
- Directories form a hierarchy (conceptually a graph).
- A path identifies a target file or directory.

### 1.4 CWD, absolute paths, and relative paths
Every process has a current working directory (CWD).
- `chdir(path)` changes CWD.
- Absolute paths ignore CWD.
- Relative paths are resolved from CWD.

Concrete examples:
- `index.html` and `./index.html`: file in current directory.
- `../index.html`: file in parent directory.
- `~/index.html`: file in home directory.

![I/O and storage layers](./lec04_materials/io_storage_layers.png)

## 2. High-Level File I/O: C Streams (`FILE*`)

### 2.1 Stream abstraction and open modes
The C stream interface (`stdio.h`) is:

```c
FILE *fopen(const char *filename, const char *mode);
int fclose(FILE *fp);
```

`fopen` returns a pointer to a `FILE` object. On failure, it returns `NULL`.

![C stream open modes](./lec04_materials/c_stream_open_modes.png)

Common modes:
- `r/rb`: open existing file for reading.
- `w/wb`: open for writing; create if needed; truncate if existing.
- `a/ab`: append mode; create if needed.
- `r+/rb+`, `w+/wb+`, `a+/ab+`: read/write variants.

### 2.2 Standard streams and composition
Programs start with three predefined streams:
- `stdin`
- `stdout`
- `stderr`

All can be redirected. Example:
- `cat hello.txt | grep "World!"`
- `cat` writes to `stdout`, and that stream becomes `grep`'s `stdin`.

### 2.3 Main stream API groups
- Character I/O: `fputc`, `fputs`, `fgetc`, `fgets`
- Block I/O: `fread`, `fwrite`
- Formatted I/O: `fprintf`, `fscanf`

### 2.4 Concrete example: char-by-char copy

```c
FILE *input = fopen("input.txt", "r");
FILE *output = fopen("output.txt", "w");
int c = fgetc(input);
while (c != EOF) {
  fputc(c, output);
  c = fgetc(input);
}
fclose(input);
fclose(output);
```

This performs one-byte-at-a-time reading and writing.

### 2.5 Concrete example: block-by-block copy

```c
#define BUFFER_SIZE 1024
FILE *input = fopen("input.txt", "r");
FILE *output = fopen("output.txt", "w");
char buffer[BUFFER_SIZE];
size_t n = fread(buffer, sizeof(char), BUFFER_SIZE, input);
while (n > 0) {
  fwrite(buffer, sizeof(char), n, output);
  n = fread(buffer, sizeof(char), BUFFER_SIZE, input);
}
fclose(input);
fclose(output);
```

This copies data in chunks and is usually faster than char-by-char copying.

### 2.6 Positioning APIs

```c
int fseek(FILE *stream, long int offset, int whence);
long int ftell(FILE *stream);
void rewind(FILE *stream);
```

`whence` options:
- `SEEK_SET`: offset from beginning.
- `SEEK_CUR`: offset from current position.
- `SEEK_END`: offset from file end.

### 2.7 Correctness discipline in system code
Return values must be checked consistently. For example, `fopen` must be checked against `NULL`, and errors should be surfaced using tools such as `perror`.

:::tip Practical coding rule
Short teaching snippets often omit error handling for brevity, but production-quality system code should always validate return values from `open/read/write/fopen/fread/...`.
:::

## 3. Low-Level File I/O: File Descriptors

### 3.1 Raw syscall interface
Low-level I/O uses integer file descriptors:

```c
int open(const char *filename, int flags, mode_t mode);
int creat(const char *filename, mode_t mode);
int close(int filedes);
ssize_t read(int filedes, void *buffer, size_t maxsize);
ssize_t write(int filedes, const void *buffer, size_t size);
off_t lseek(int filedes, off_t offset, int whence);
```

![Raw syscall interface](./lec04_materials/raw_syscall_interface.png)

`open` returns an integer fd.
- `fd < 0` means error, and `errno` stores the reason.

### 3.2 What `open` configures
`open` arguments encode:
- Access mode (read/write).
- Open flags (`O_CREAT`, etc.).
- Optional permission bits (`mode`) when creation is involved.

### 3.3 Pre-opened descriptors and bridges
Pre-opened standard descriptors:
- `STDIN_FILENO == 0`
- `STDOUT_FILENO == 1`
- `STDERR_FILENO == 2`

Bridge helpers:
- `fileno(FILE *stream)`: extract fd from a stream.
- `fdopen(int filedes, const char *mode)`: wrap an existing fd as `FILE*`.

### 3.4 Concrete example: `lowio.c`

```c
char buf[1000];
int fd = open("lowio.c", O_RDONLY, S_IRUSR | S_IWUSR);
ssize_t rd = read(fd, buf, sizeof(buf));
close(fd);
write(STDOUT_FILENO, buf, rd);
```

This program reads **up to** 1000 bytes from `lowio.c` and writes the returned count to standard output.

:::remark Question: How many bytes does this program read?
The call `read(fd, buf, sizeof(buf))` requests 1000 bytes, but the actual return can be any value from `0` to `1000` (or `-1` on error). A single `read` is not guaranteed to fill the buffer.
:::

### 3.5 POSIX I/O design patterns
The most important design points are:
- **Open before use**: authorization and setup happen at `open`.
- **Byte-oriented interface**: addressing is in bytes even if devices transfer blocks internally.
- **Kernel-buffered reads/writes**: kernel may decouple device timing from user execution.
- **Explicit close**: resources are released intentionally via `close`.

### 3.6 Other low-level operations
Commonly used related operations include:
- `ioctl` for device- or endpoint-specific control.
- `dup` and `dup2` for descriptor duplication.
- `pipe` for unidirectional IPC channels.
- File locking, memory mapping, and asynchronous I/O APIs.

## 4. High-Level vs. Low-Level and Why Buffering Exists

### 4.1 Call path comparison
Both high-level and low-level APIs eventually invoke syscalls.
- Low-level calls are thin wrappers over kernel operations.
- High-level calls add user-space logic around those syscalls.

![High-level vs low-level syscall path](./lec04_materials/high_vs_low_syscall_path.png)

### 4.2 What is inside a `FILE*`
A useful model for `FILE*` includes:
- An underlying file descriptor.
- A user-space buffer.
- A lock for thread-safe stream access.

### 4.3 Buffering behavior with `fwrite`
`fwrite` typically appends data into the stream buffer first.
- Data is flushed to the underlying fd when needed (for example, buffer full).
- The runtime may flush earlier under certain conditions.
- Correct code must not assume a specific implicit flush time.

### 4.4 Concrete example: reading visibility without `fflush`

```c
char x = 'c';
FILE *f1 = fopen("file.txt", "w");
fwrite("b", sizeof(char), 1, f1);
FILE *f2 = fopen("file.txt", "r");
fread(&x, sizeof(char), 1, f2);
```

:::remark Question: What is the value of `x`?
`x` may become `'b'`, or it may remain `'c'` if `fread` does not observe the buffered write yet.
:::

### 4.5 Concrete example: enforcing visibility with `fflush`

```c
char x = 'c';
FILE *f1 = fopen("file.txt", "wb");
fwrite("b", sizeof(char), 1, f1);
fflush(f1);
FILE *f2 = fopen("file.txt", "rb");
fread(&x, sizeof(char), 1, f2);
```

Now `fread` deterministically sees `'b'`.

### 4.6 Why user-space buffering: pros and cons
Benefits:
- Fewer syscalls, so significantly better throughput.
- Richer functionality (`fgets`, `getline`, formatted parsing/printing).
- Cleaner kernel interfaces that stay format-agnostic.

Costs:
- More state to reason about (flush timing, visibility, ordering).
- Easy correctness bugs if assumptions about buffer flush are wrong.

:::tip Discussion question: Why buffer in user space?
Because syscall boundaries are expensive and kernel interfaces are intentionally low-level. User-space buffering improves both performance and usability, but it requires explicit synchronization points (`fflush`, `fclose`) when visibility must be guaranteed.
:::

## 5. Kernel State: fd Table and Open File Description

### 5.1 Two-level state model
On successful `open`:
- User receives an integer fd.
- Kernel creates an **open file description** object.

For each process, the fd table maps:
- `fd -> open file description`

![Initial process fd mapping](./lec04_materials/process_fd_open_file_mapping_initial.png)

### 5.2 What an open file description stores
Two critical fields:
- File identity/location.
- Current file position (offset).

### 5.3 State-change sequence: `open -> read -> close`
A concrete flow:
1. `open("foo.txt")` returns `fd=3`, with initial offset `0`.
2. `read(3, buf, 100)` returns `100`, so offset becomes `100`.
3. Another `read(3, buf, 100)` continues from offset `100`.
4. `close(3)` removes that process's fd-table entry.

![Offset advances after read](./lec04_materials/process_fd_open_file_after_read.png)

## 6. `fork()`, Aliasing, and Descriptor Duplication

### 6.1 What changes after `fork`
After `fork`:
- Parent fd entries are copied into child.
- Parent and child entries alias the **same** open file description.

![fork copies fd entries and aliases open file description](./lec04_materials/fork_fd_copy_open_file_alias.png)

### 6.2 Shared-offset process flow
Because the open file description is shared, the offset is shared too:
1. Parent and child both have `fd=3`.
2. Parent reads 100 bytes; shared offset increases.
3. Child reads; it continues from the new offset, not from the old one.
4. Further reads by either process keep advancing the same shared position.

![Aliased open file offset is shared](./lec04_materials/aliased_open_file_offset_shared.png)

### 6.3 Close removes one reference, not the object itself
Closing one descriptor drops one reference only.
The open file description remains alive until no descriptors in any process reference it.

![Close drops one reference, object can remain alive](./lec04_materials/close_only_drops_one_reference.png)

### 6.4 Why aliasing is useful
Aliasing enables intentional resource sharing across processes:
- Shared terminal endpoints.
- Shared network connections after `fork`.
- Shared pipe endpoints for IPC and shell pipelines.

:::remark Question: Why is aliasing a good idea?
Aliasing lets multiple processes coordinate through the same underlying resource state when that sharing is exactly what we want.
:::

### 6.5 Concrete example: shared terminal emulator
After `fork`, parent and child typically share inherited descriptors `0/1/2` to the same terminal endpoint.
- Both processes print to the same terminal output.
- If Process A executes `close(0)`, Process B can still keep its own `fd 0` open.

![Shared terminal stdio across processes](./lec04_materials/shared_terminal_stdio.png)

### 6.6 Concrete example: `dup` and `dup2`
A complete state sequence:
1. `open("foo.txt") -> 3`
2. `read(3, buf, 100)` advances shared offset to `100`
3. `dup(3) -> 4`
4. `dup2(3, 162)` makes fd `162` also point to the same open file description

So `3`, `4`, and `162` share one underlying offset and file state.

![dup and dup2 aliasing behavior](./lec04_materials/dup_dup2_aliasing.png)

## 7. Pitfalls and Correctness Rules

### 7.1 Multithreaded `fork` hazard
A critical rule is:
- **Do not fork carelessly in a process that already has multiple threads.**

After `fork`, the child keeps only the calling thread; other threads disappear.
Potential failures:
- A vanished thread may have been holding a lock.
- A vanished thread may have been mid-update on shared data.
- No cleanup for those vanished execution states.

Safe pattern:
- If a multithreaded process must call `fork`, the child should call `exec` promptly.

:::warn Question: Why can multithreaded `fork` break correctness?
Because lock/data invariants may have depended on threads that no longer exist in the child. The child inherits memory, but not those threads' execution progress.
:::

### 7.2 Do not carelessly mix `FILE*` and `fd`
Problematic example:

```c
char x[10], y[10];
FILE *f = fopen("foo.txt", "rb");
int fd = fileno(f);
fread(x, 10, 1, f);
read(fd, y, 10);
```

Question: which bytes are read into `y`?
- A. bytes `0..9`
- B. bytes `10..19`
- C. none of these

Correct answer: **C**.

Reason:
- `fread` can prefetch a large chunk into user-space buffer.
- Kernel offset and stream-buffer state no longer match the simple "next 10 bytes" assumption.

![Avoid mixing FILE* and file descriptors](./lec04_materials/avoid_mixing_file_and_fd.png)

:::warn Practical rule
Prefer one abstraction boundary per data path:
- all-stream (`FILE*`) style, or
- all-fd/syscall style.

If bridging is unavoidable, reason explicitly about buffering, offsets, and flush behavior.
:::

## 8. Conclusion
Key takeaways:
- POSIX unifies many resources under one file-oriented interface.
- High-level and low-level APIs both matter, but they expose different state models.
- Correctness depends on understanding buffer visibility and kernel open-file state transitions.
- `fork`, `dup`, and mixed I/O usage are major sources of subtle bugs.

## Appendix A. Exam Review

### A.1 Must-know definitions
- **"Everything is a file."**
- File, metadata, directory, path, CWD.
- File descriptor vs open file description.
- Stream (`FILE*`) and user-space buffering.

### A.2 Must-know APIs
- High-level: `fopen`, `fclose`, `fread`, `fwrite`, `fgetc`, `fgets`, `fseek`, `fflush`.
- Low-level: `open`, `creat`, `read`, `write`, `close`, `lseek`, `dup`, `dup2`, `pipe`, `ioctl`.
- Bridge: `fileno`, `fdopen`.

### A.3 Must-know state-change flows
- `open -> fd returned + open file description created`.
- `read/write -> shared offset advances in that open file description`.
- `fork -> fd table copied, open file description aliased`.
- `close(fd) -> one reference removed; object destroyed only when no references remain`.
- `dup/dup2 -> additional fd entries alias same open file description`.

### A.4 Typical short-answer points
- Why user-space buffering exists: syscall amortization + richer API functionality.
- Why `fflush` matters: visibility timing is otherwise not deterministic enough for strict assumptions.
- Why fd is integer, not kernel pointer: isolation and safety.
- Why multithreaded `fork` is dangerous: child loses non-calling threads and may inherit inconsistent lock/data state.
- Why mixing `FILE*` and fd is risky: two buffering/position models can diverge.

### A.5 Self-check list
- Can you explain why one `read` may return fewer bytes than requested?
- Can you trace offset evolution across `open/read/fork/read/close`?
- Can you explain why closing one aliased fd does not necessarily close the underlying open file description?
- Can you explain exactly why the mixed `fread` + `read` example returns option C?
- Can you rewrite a mixed-I/O snippet into a single abstraction style?
