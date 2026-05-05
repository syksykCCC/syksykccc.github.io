# C/C++ API 参数与用法速查

范围说明：

- 这里整理的是 Lec1-Lec13 课件中出现或直接相关的 C/C++、POSIX、pthread、socket、C++ RAII 接口。
- 课堂伪 API、硬件原子原语、调度器伪代码单独放在最后；它们不是标准库函数，但考试常考语义。
- `Producer()`、`Consumer()`、`Deposit()`、`serve_client()` 这类业务示例函数不是系统 API，没有列入主表。

## 1. C 基础、内存与错误输出

### `malloc`

```c
#include <stdlib.h>
void *malloc(size_t size);
```

- `size`：申请的字节数。
- 返回：成功返回堆内存首地址；失败返回 `NULL`。

```c
int *a = malloc(10 * sizeof(int));
if (a == NULL) {
    perror("malloc");
    exit(1);
}
free(a);
```

### `free`

```c
#include <stdlib.h>
void free(void *ptr);
```

- `ptr`：之前由 `malloc/calloc/realloc` 返回的指针，或 `NULL`。
- 返回：无。

```c
char *buf = malloc(1024);
/* use buf */
free(buf);
buf = NULL;
```

### C++ `new` / `delete`

```cpp
T *p = new T(args...);
delete p;

T *arr = new T[n];
delete[] arr;
```

- `new`：构造对象并返回指针；失败通常抛出 `std::bad_alloc`。
- `delete`：析构对象并释放内存。
- `new[]` 必须配 `delete[]`。

```cpp
int *x = new int(42);
delete x;

int *a = new int[10];
delete[] a;
```

### `strlen`

```c
#include <string.h>
size_t strlen(const char *s);
```

- `s`：以 `'\0'` 结尾的 C 字符串。
- 返回：不包括结尾 `'\0'` 的字符数。

```c
const char *msg = "hello";
write(fd, msg, strlen(msg));
```

### `printf`

```c
#include <stdio.h>
int printf(const char *format, ...);
```

- `format`：格式字符串。
- `...`：与格式占位符对应的参数。
- 返回：成功输出的字符数；失败返回负数。

```c
printf("value=%d\n", value);
```

### `perror`

```c
#include <stdio.h>
void perror(const char *s);
```

- `s`：用户提供的前缀字符串。
- 作用：根据当前 `errno` 打印错误原因到 `stderr`。

```c
int fd = open("missing.txt", O_RDONLY);
if (fd < 0) {
    perror("open");
}
```

### `setjmp` / `longjmp`

```c
#include <setjmp.h>
int setjmp(jmp_buf env);
void longjmp(jmp_buf env, int val);
```

- `env`：保存跳转上下文的缓冲区。
- `setjmp`：第一次直接调用返回 `0`；被 `longjmp` 跳回时返回 `val`。
- `longjmp`：非局部跳转回对应 `setjmp`，可能跳过锁释放、资源清理。

```c
jmp_buf env;

if (setjmp(env) == 0) {
    longjmp(env, 1);
} else {
    printf("jumped back\n");
}
```

## 2. C 标准 I/O：`FILE *`

### `fopen`

```c
#include <stdio.h>
FILE *fopen(const char *filename, const char *mode);
```

- `filename`：路径。
- `mode`：打开模式，如 `"r"`、`"w"`、`"a"`、`"rb"`、`"wb"`、`"r+"`。
- 返回：成功返回 `FILE *`；失败返回 `NULL`。

```c
FILE *f = fopen("input.txt", "r");
if (f == NULL) {
    perror("fopen");
}
```

### `fclose`

```c
#include <stdio.h>
int fclose(FILE *stream);
```

- `stream`：要关闭的流。
- 返回：成功 `0`；失败 `EOF`。
- 关闭输出流时通常会刷新缓冲区。

```c
FILE *f = fopen("out.txt", "w");
fprintf(f, "hello\n");
fclose(f);
```

### `fgetc`

```c
#include <stdio.h>
int fgetc(FILE *stream);
```

- `stream`：输入流。
- 返回：读到的字符，转成 `unsigned char` 后作为 `int` 返回；EOF 或错误返回 `EOF`。

```c
int c;
while ((c = fgetc(stdin)) != EOF) {
    fputc(c, stdout);
}
```

### `fputc`

```c
#include <stdio.h>
int fputc(int c, FILE *stream);
```

- `c`：要写的字符。
- `stream`：输出流。
- 返回：成功返回写入字符；失败返回 `EOF`。

```c
fputc('A', stdout);
```

### `fgets`

```c
#include <stdio.h>
char *fgets(char *s, int size, FILE *stream);
```

- `s`：目标缓冲区。
- `size`：缓冲区大小，最多读 `size - 1` 个字符。
- `stream`：输入流。
- 返回：成功返回 `s`；EOF 或错误返回 `NULL`。

```c
char line[128];
if (fgets(line, sizeof(line), stdin) != NULL) {
    fputs(line, stdout);
}
```

### `fputs`

```c
#include <stdio.h>
int fputs(const char *s, FILE *stream);
```

- `s`：要写出的 C 字符串。
- `stream`：输出流。
- 返回：成功非负；失败 `EOF`。

```c
fputs("hello\n", stdout);
```

### `fread`

```c
#include <stdio.h>
size_t fread(void *ptr, size_t size, size_t nmemb, FILE *stream);
```

- `ptr`：接收缓冲区。
- `size`：每个元素大小。
- `nmemb`：最多读取多少个元素。
- `stream`：输入流。
- 返回：实际读到的元素个数，不一定等于 `nmemb`。

```c
char buf[1024];
size_t n = fread(buf, 1, sizeof(buf), stdin);
fwrite(buf, 1, n, stdout);
```

### `fwrite`

```c
#include <stdio.h>
size_t fwrite(const void *ptr, size_t size, size_t nmemb, FILE *stream);
```

- `ptr`：待写数据缓冲区。
- `size`：每个元素大小。
- `nmemb`：写入元素个数。
- `stream`：输出流。
- 返回：实际写入的元素个数。

```c
const char data[] = "abc";
size_t n = fwrite(data, 1, 3, stdout);
```

### `fprintf`

```c
#include <stdio.h>
int fprintf(FILE *stream, const char *format, ...);
```

- `stream`：输出流。
- `format`：格式字符串。
- `...`：格式化参数。
- 返回：成功写入的字符数；失败返回负数。

```c
fprintf(stderr, "error code=%d\n", code);
```

### `fscanf`

```c
#include <stdio.h>
int fscanf(FILE *stream, const char *format, ...);
```

- `stream`：输入流。
- `format`：格式字符串。
- `...`：接收变量的地址。
- 返回：成功匹配并赋值的项目数；EOF 或错误时可能返回 `EOF`。

```c
int x;
if (fscanf(stdin, "%d", &x) == 1) {
    printf("x=%d\n", x);
}
```

### `fseek`

```c
#include <stdio.h>
int fseek(FILE *stream, long int offset, int whence);
```

- `stream`：目标流。
- `offset`：偏移量。
- `whence`：`SEEK_SET`、`SEEK_CUR`、`SEEK_END`。
- 返回：成功 `0`；失败非 `0`。

```c
fseek(f, 0, SEEK_END);
```

### `ftell`

```c
#include <stdio.h>
long int ftell(FILE *stream);
```

- `stream`：目标流。
- 返回：当前位置偏移；失败返回 `-1L`。

```c
long pos = ftell(f);
```

### `rewind`

```c
#include <stdio.h>
void rewind(FILE *stream);
```

- `stream`：目标流。
- 作用：把位置重置到文件开头，并清除错误/EOF 状态。

```c
rewind(f);
```

### `fflush`

```c
#include <stdio.h>
int fflush(FILE *stream);
```

- `stream`：输出流；若为 `NULL`，刷新所有打开的输出流。
- 返回：成功 `0`；失败 `EOF`。

```c
fwrite("b", 1, 1, f);
fflush(f);  // 让用户态缓冲写到底层 fd
```

### `getline`（POSIX）

```c
#define _GNU_SOURCE
#include <stdio.h>
ssize_t getline(char **lineptr, size_t *n, FILE *stream);
```

- `lineptr`：指向缓冲区指针的地址；若 `*lineptr == NULL`，函数可自动分配。
- `n`：缓冲区容量变量地址。
- `stream`：输入流。
- 返回：读到的字节数；EOF 或错误返回 `-1`。

```c
char *line = NULL;
size_t cap = 0;
ssize_t len = getline(&line, &cap, stdin);
free(line);
```

## 3. POSIX 文件描述符与低层 I/O

### `open`

```c
#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>
int open(const char *pathname, int flags, ... /* mode_t mode */);
```

- `pathname`：路径。
- `flags`：访问模式和标志，如 `O_RDONLY`、`O_WRONLY`、`O_RDWR`、`O_CREAT`、`O_TRUNC`。
- `mode`：创建文件时的权限位；只有使用 `O_CREAT` 等创建标志时才需要。
- 返回：成功返回文件描述符；失败返回 `-1` 并设置 `errno`。

```c
int fd = open("out.txt", O_WRONLY | O_CREAT | O_TRUNC, S_IRUSR | S_IWUSR);
if (fd < 0) {
    perror("open");
}
```

### `creat`

```c
#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>
int creat(const char *pathname, mode_t mode);
```

- `pathname`：路径。
- `mode`：创建权限。
- 返回：成功返回 fd；失败返回 `-1`。
- 等价于 `open(pathname, O_WRONLY | O_CREAT | O_TRUNC, mode)`。

```c
int fd = creat("log.txt", S_IRUSR | S_IWUSR);
```

### `close`

```c
#include <unistd.h>
int close(int fd);
```

- `fd`：文件描述符。
- 返回：成功 `0`；失败 `-1`。
- 注意：`close` 只移除当前进程的一个 fd 引用；底层 open file description 可能仍被别的 fd/进程引用。

```c
close(fd);
```

### `read`

```c
#include <unistd.h>
ssize_t read(int fd, void *buf, size_t count);
```

- `fd`：读取来源。
- `buf`：接收缓冲区。
- `count`：最多读取字节数。
- 返回：实际读取字节数；`0` 表示 EOF；失败 `-1`。
- 一次 `read` 不保证填满缓冲区。

```c
char buf[1000];
ssize_t n = read(fd, buf, sizeof(buf));
if (n > 0) {
    write(STDOUT_FILENO, buf, n);
}
```

### `write`

```c
#include <unistd.h>
ssize_t write(int fd, const void *buf, size_t count);
```

- `fd`：写入目标。
- `buf`：待写缓冲区。
- `count`：请求写入字节数。
- 返回：实际写入字节数；失败 `-1`。
- 对 pipe/socket 可能出现短写或阻塞。

```c
const char *msg = "hello\n";
write(STDOUT_FILENO, msg, strlen(msg));
```

### `lseek`

```c
#include <sys/types.h>
#include <unistd.h>
off_t lseek(int fd, off_t offset, int whence);
```

- `fd`：文件描述符。
- `offset`：偏移量。
- `whence`：`SEEK_SET`、`SEEK_CUR`、`SEEK_END`。
- 返回：新的文件偏移；失败返回 `(off_t)-1`。

```c
lseek(fd, 0, SEEK_SET);
```

### `dup`

```c
#include <unistd.h>
int dup(int oldfd);
```

- `oldfd`：要复制的描述符。
- 返回：新的最低可用 fd；失败返回 `-1`。
- 新旧 fd 指向同一个 open file description，共享 offset。

```c
int fd2 = dup(fd);
```

### `dup2`

```c
#include <unistd.h>
int dup2(int oldfd, int newfd);
```

- `oldfd`：源 fd。
- `newfd`：目标 fd；若已打开会先关闭。
- 返回：成功返回 `newfd`；失败返回 `-1`。

```c
dup2(fd, STDOUT_FILENO);  // 把标准输出重定向到 fd
```

### `pipe`

```c
#include <unistd.h>
int pipe(int pipefd[2]);
```

- `pipefd[0]`：读端。
- `pipefd[1]`：写端。
- 返回：成功 `0`；失败 `-1`。

```c
int p[2];
pipe(p);
write(p[1], "x", 1);
char c;
read(p[0], &c, 1);
close(p[0]);
close(p[1]);
```

### `ioctl`

```c
#include <sys/ioctl.h>
int ioctl(int fd, unsigned long request, ...);
```

- `fd`：设备或端点描述符。
- `request`：设备相关控制命令。
- `...`：命令相关参数，通常是指针。
- 返回：成功通常为 `0` 或命令定义的值；失败 `-1`。

```c
/* 具体 request 与参数取决于设备，这里只展示调用形态 */
int ret = ioctl(fd, request, argp);
```

### `fileno`

```c
#include <stdio.h>
int fileno(FILE *stream);
```

- `stream`：C 流。
- 返回：底层 fd；失败返回 `-1`。

```c
FILE *f = fopen("foo.txt", "r");
int fd = fileno(f);
```

### `fdopen`

```c
#include <stdio.h>
FILE *fdopen(int fd, const char *mode);
```

- `fd`：已有文件描述符。
- `mode`：流打开模式，如 `"r"`、`"w"`。
- 返回：成功返回 `FILE *`；失败返回 `NULL`。

```c
int fd = open("foo.txt", O_RDONLY);
FILE *f = fdopen(fd, "r");
```

## 4. 进程与信号

### `fork`

```c
#include <unistd.h>
pid_t fork(void);
```

- 参数：无。
- 返回：
  - 子进程中返回 `0`；
  - 父进程中返回子进程 PID；
  - 失败返回 `-1`。

```c
pid_t pid = fork();
if (pid == 0) {
    printf("child\n");
    exit(0);
} else if (pid > 0) {
    wait(NULL);
}
```

### `exit`

```c
#include <stdlib.h>
void exit(int status);
```

- `status`：进程退出码，父进程可通过 `wait` 观察。
- 返回：不返回。

```c
exit(42);
```

### `exec` family

常用变体：

```c
#include <unistd.h>
int execl(const char *path, const char *arg, ... /*, (char *) NULL */);
int execv(const char *path, char *const argv[]);
int execvp(const char *file, char *const argv[]);
int execve(const char *pathname, char *const argv[], char *const envp[]);
```

- `path/pathname`：可执行文件路径。
- `file`：文件名；`execvp` 会按 `PATH` 搜索。
- `arg...` / `argv`：新程序的参数，约定 `argv[0]` 是程序名。
- `envp`：新环境变量数组。
- 返回：成功时不返回；失败时返回 `-1`。

```c
pid_t pid = fork();
if (pid == 0) {
    execl("/bin/ls", "ls", "-l", (char *)NULL);
    perror("execl");
    exit(1);
}
wait(NULL);
```

### `wait`

```c
#include <sys/types.h>
#include <sys/wait.h>
pid_t wait(int *wstatus);
```

- `wstatus`：接收子进程退出状态；不关心可传 `NULL`。
- 返回：结束的子进程 PID；失败返回 `-1`。

```c
int status;
pid_t child = wait(&status);
```

### `kill`

```c
#include <sys/types.h>
#include <signal.h>
int kill(pid_t pid, int sig);
```

- `pid`：目标进程或进程组。
- `sig`：信号编号，如 `SIGINT`、`SIGTERM`。
- 返回：成功 `0`；失败 `-1`。

```c
kill(child_pid, SIGINT);
```

### `sigaction`

```c
#include <signal.h>
int sigaction(int signum, const struct sigaction *act, struct sigaction *oldact);
```

- `signum`：信号编号。
- `act`：新的处理方式。
- `oldact`：保存旧处理方式；不需要可传 `NULL`。
- 返回：成功 `0`；失败 `-1`。

```c
void handler(int signo) {
    write(STDOUT_FILENO, "signal\n", 7);
}

struct sigaction sa = {0};
sa.sa_handler = handler;
sigemptyset(&sa.sa_mask);
sigaction(SIGINT, &sa, NULL);
```

### `sigemptyset`

```c
#include <signal.h>
int sigemptyset(sigset_t *set);
```

- `set`：要初始化的信号集合。
- 作用：把集合清空，常用于初始化 `struct sigaction` 的 `sa_mask`。
- 返回：成功 `0`；失败 `-1`。

```c
struct sigaction sa = {0};
sigemptyset(&sa.sa_mask);
sa.sa_handler = handler;
sigaction(SIGINT, &sa, NULL);
```

## 5. pthread 线程、互斥锁与条件变量

### `pthread_create`

```c
#include <pthread.h>
int pthread_create(pthread_t *thread,
                   const pthread_attr_t *attr,
                   void *(*start_routine)(void *),
                   void *arg);
```

- `thread`：输出参数，保存新线程 ID。
- `attr`：线程属性；默认可传 `NULL`。
- `start_routine`：新线程入口函数，参数和返回值类型都是 `void *`。
- `arg`：传给入口函数的参数。
- 返回：成功 `0`；失败返回错误码。

```c
void *worker(void *arg) {
    int id = *(int *)arg;
    printf("worker %d\n", id);
    return NULL;
}

pthread_t tid;
int id = 1;
pthread_create(&tid, NULL, worker, &id);
pthread_join(tid, NULL);
```

### `pthread_exit`

```c
#include <pthread.h>
void pthread_exit(void *value_ptr);
```

- `value_ptr`：线程退出值，可被 `pthread_join` 取回。
- 返回：不返回。

```c
void *worker(void *arg) {
    pthread_exit(arg);
}
```

### `pthread_join`

```c
#include <pthread.h>
int pthread_join(pthread_t thread, void **value_ptr);
```

- `thread`：要等待的线程 ID。
- `value_ptr`：接收目标线程返回值；不需要可传 `NULL`。
- 返回：成功 `0`；失败返回错误码。

```c
void *ret;
pthread_join(tid, &ret);
```

### `pthread_mutex_init`

```c
#include <pthread.h>
int pthread_mutex_init(pthread_mutex_t *mutex,
                       const pthread_mutexattr_t *attr);
```

- `mutex`：要初始化的互斥锁。
- `attr`：属性；默认可传 `NULL`。
- 返回：成功 `0`；失败返回错误码。

```c
pthread_mutex_t lock;
pthread_mutex_init(&lock, NULL);
```

### `pthread_mutex_lock`

```c
#include <pthread.h>
int pthread_mutex_lock(pthread_mutex_t *mutex);
```

- `mutex`：目标互斥锁。
- 返回：成功 `0`；失败返回错误码。
- 若锁已被其他线程持有，调用线程阻塞。

```c
pthread_mutex_lock(&lock);
shared++;
pthread_mutex_unlock(&lock);
```

### `pthread_mutex_unlock`

```c
#include <pthread.h>
int pthread_mutex_unlock(pthread_mutex_t *mutex);
```

- `mutex`：目标互斥锁。
- 返回：成功 `0`；失败返回错误码。

```c
pthread_mutex_unlock(&lock);
```

### `pthread_cond_wait`

课件常写作抽象接口 `cond_wait(cv, lock)`；对应 pthread 常见接口为：

```c
#include <pthread.h>
int pthread_cond_wait(pthread_cond_t *cond, pthread_mutex_t *mutex);
```

- `cond`：条件变量。
- `mutex`：与条件变量关联的互斥锁，调用时必须已经持有。
- 语义：原子地释放 `mutex` 并睡眠；被唤醒返回前重新获取 `mutex`。
- 返回：成功 `0`；失败返回错误码。

```c
pthread_mutex_lock(&lock);
while (queue_empty()) {
    pthread_cond_wait(&not_empty, &lock);
}
item = dequeue();
pthread_mutex_unlock(&lock);
```

### `pthread_cond_signal`

```c
#include <pthread.h>
int pthread_cond_signal(pthread_cond_t *cond);
```

- `cond`：条件变量。
- 语义：唤醒一个等待者；若无人等待，效果为空。
- 返回：成功 `0`；失败返回错误码。

```c
pthread_mutex_lock(&lock);
enqueue(item);
pthread_cond_signal(&not_empty);
pthread_mutex_unlock(&lock);
```

### `pthread_cond_broadcast`

```c
#include <pthread.h>
int pthread_cond_broadcast(pthread_cond_t *cond);
```

- `cond`：条件变量。
- 语义：唤醒所有等待者；等待者恢复后仍要重新竞争锁并检查条件。
- 返回：成功 `0`；失败返回错误码。

```c
pthread_mutex_lock(&lock);
shutdown = 1;
pthread_cond_broadcast(&not_empty);
pthread_mutex_unlock(&lock);
```

## 6. POSIX semaphore 对应写法

课件主要用 `P/V`、`semaP/semaV` 描述信号量。真实 POSIX 中常见对应接口如下。

### `sem_init`

```c
#include <semaphore.h>
int sem_init(sem_t *sem, int pshared, unsigned int value);
```

- `sem`：信号量对象。
- `pshared`：`0` 表示线程间共享；非 `0` 表示进程间共享。
- `value`：初值。
- 返回：成功 `0`；失败 `-1`。

```c
sem_t empty;
sem_init(&empty, 0, BUFSIZE);
```

### `sem_wait`

```c
#include <semaphore.h>
int sem_wait(sem_t *sem);
```

- `sem`：目标信号量。
- 语义：对应 `P/down`，等待值大于 0 后减 1。
- 返回：成功 `0`；失败 `-1`。

```c
sem_wait(&empty);
```

### `sem_post`

```c
#include <semaphore.h>
int sem_post(sem_t *sem);
```

- `sem`：目标信号量。
- 语义：对应 `V/up`，值加 1，并可能唤醒等待者。
- 返回：成功 `0`；失败 `-1`。

```c
sem_post(&full);
```

## 7. Socket 与网络 IPC

### `socket`

```c
#include <sys/types.h>
#include <sys/socket.h>
int socket(int domain, int type, int protocol);
```

- `domain`：地址族，如 `AF_INET`、`AF_INET6`。
- `type`：socket 类型，如 `SOCK_STREAM` 表示 TCP 字节流。
- `protocol`：协议；通常传 `0` 让系统按前两个参数选择默认协议。
- 返回：成功返回 socket fd；失败返回 `-1`。

```c
int s = socket(AF_INET, SOCK_STREAM, 0);
```

### `bind`

```c
#include <sys/types.h>
#include <sys/socket.h>
int bind(int sockfd, const struct sockaddr *addr, socklen_t addrlen);
```

- `sockfd`：socket fd。
- `addr`：本地地址与端口。
- `addrlen`：地址结构长度。
- 返回：成功 `0`；失败 `-1`。

```c
struct sockaddr_in addr = {0};
addr.sin_family = AF_INET;
addr.sin_addr.s_addr = htonl(INADDR_ANY);
addr.sin_port = htons(8080);
bind(s, (struct sockaddr *)&addr, sizeof(addr));
```

### `listen`

```c
#include <sys/types.h>
#include <sys/socket.h>
int listen(int sockfd, int backlog);
```

- `sockfd`：已绑定的监听 socket。
- `backlog`：连接队列长度提示。
- 返回：成功 `0`；失败 `-1`。

```c
listen(s, 128);
```

### `accept`

```c
#include <sys/types.h>
#include <sys/socket.h>
int accept(int sockfd, struct sockaddr *addr, socklen_t *addrlen);
```

- `sockfd`：监听 socket。
- `addr`：输出参数，保存客户端地址；不关心可传 `NULL`。
- `addrlen`：输入/输出参数，传入缓冲区大小，返回实际地址长度。
- 返回：成功返回新的连接 socket fd；失败返回 `-1`。

```c
int conn = accept(s, NULL, NULL);
write(conn, "hello\n", 6);
close(conn);
```

### `connect`

```c
#include <sys/types.h>
#include <sys/socket.h>
int connect(int sockfd, const struct sockaddr *addr, socklen_t addrlen);
```

- `sockfd`：客户端 socket。
- `addr`：服务器地址。
- `addrlen`：地址结构长度。
- 返回：成功 `0`；失败 `-1`。

```c
struct sockaddr_in srv = {0};
srv.sin_family = AF_INET;
srv.sin_port = htons(8080);
inet_pton(AF_INET, "127.0.0.1", &srv.sin_addr);
connect(s, (struct sockaddr *)&srv, sizeof(srv));
```

### socket 上的 `read` / `write` / `close`

socket fd 和普通 fd 一样可用：

```c
write(conn, request, request_len);
ssize_t n = read(conn, buf, sizeof(buf));
close(conn);
```

注意：

- TCP 是字节流，不保留消息边界。
- 一次 `read` 不等价于一次完整请求。
- 若最后一个读端关闭，pipe 写端可能触发 `SIGPIPE`；socket 写入断开的连接也可能出现类似错误行为。

### `htons` / `htonl` / `inet_pton`

这些是 socket 示例中常配套使用的地址转换函数。

```c
#include <arpa/inet.h>
uint16_t htons(uint16_t hostshort);
uint32_t htonl(uint32_t hostlong);
int inet_pton(int af, const char *src, void *dst);
```

- `htons`：host-to-network short，常用于端口。
- `htonl`：host-to-network long，常用于 IPv4 地址整数。
- `inet_pton`：把文本 IP 转为二进制网络地址。

```c
addr.sin_port = htons(80);
inet_pton(AF_INET, "127.0.0.1", &addr.sin_addr);
```

## 8. C++ 同步接口

### `std::mutex`

```cpp
#include <mutex>
class std::mutex {
public:
    void lock();
    bool try_lock();
    void unlock();
};
```

- `lock()`：获取锁；若不可用则阻塞。
- `try_lock()`：尝试获取；成功返回 `true`，失败返回 `false`。
- `unlock()`：释放锁。

```cpp
std::mutex m;
int shared = 0;

m.lock();
++shared;
m.unlock();
```

### `std::lock_guard<std::mutex>`

```cpp
#include <mutex>
template<class Mutex>
class lock_guard {
public:
    explicit lock_guard(Mutex& m);
    ~lock_guard();
};
```

- 构造时获取锁。
- 析构时释放锁。
- 用 RAII 避免异常或提前返回时忘记解锁。

```cpp
std::mutex m;
int shared = 0;

void inc() {
    std::lock_guard<std::mutex> guard(m);
    ++shared;
} // 离开作用域自动 unlock
```

## 9. 调度相关 Unix 接口

### `nice`

```c
#include <unistd.h>
int nice(int inc);
```

- `inc`：在当前 nice 值基础上增加的量；增加后通常优先级更低。
- 返回：成功时返回新的 nice 值；失败返回 `-1` 并设置 `errno`。
- 课件重点是 nice 值语义：`-20` 更高优先级，`19` 更低优先级。

```c
errno = 0;
int new_nice = nice(5);
if (new_nice == -1 && errno != 0) {
    perror("nice");
}
```

## 10. 课堂抽象 API 与伪代码

这一部分不是标准 C/C++ 库函数，但它们在课件里作为机制考察点出现。

### 锁：`Lock.acquire()` / `Lock.release()`

```c
void Lock_acquire(Lock *lock);
void Lock_release(Lock *lock);
```

- `lock`：锁对象。
- `acquire`：等待锁空闲并原子占有。
- `release`：释放锁，并可能唤醒等待者。

```c
Lock_acquire(&buf_lock);
Enqueue(item);
Lock_release(&buf_lock);
```

### 信号量：`P/down` 与 `V/up`

```c
void P(Semaphore *s);  // down
void V(Semaphore *s);  // up
```

- `P(s)`：等待 `s > 0`，然后原子地 `s--`。
- `V(s)`：原子地 `s++`，并唤醒等待者。

```c
P(&emptySlots);
P(&mutex);
Enqueue(item);
V(&mutex);
V(&fullSlots);
```

### 课程写法：`semaP` / `semaV`

```c
void semaP(Semaphore *s);
void semaV(Semaphore *s);
```

- 与 `P/V` 同义。

```c
semaP(&fullSlots);
semaP(&mutex);
item = Dequeue();
semaV(&mutex);
semaV(&emptySlots);
```

### 条件变量：`Wait` / `Signal` / `Broadcast`

```c
void Wait(Condition *cv, Lock *lock);
void Signal(Condition *cv);
void Broadcast(Condition *cv);
```

- `Wait`：调用时必须持有 `lock`；它原子释放锁并睡眠，返回前重新获取锁。
- `Signal`：唤醒一个等待线程；若无人等待则无效果。
- `Broadcast`：唤醒所有等待线程。

```c
Lock_acquire(&lock);
while (isEmpty(queue)) {
    Wait(&notEmpty, &lock);
}
item = Dequeue();
Lock_release(&lock);
```

### 课程写法：`cond_wait` / `cond_signal`

```c
void cond_wait(Condition *cv, Lock *lock);
void cond_signal(Condition *cv);
```

- `cond_wait`：等价于上面的 `Wait(cv, lock)`。
- `cond_signal`：等价于 `Signal(cv)`。
- Mesa 语义下，等待条件必须写成 `while`，不是 `if`。

```c
while (buffer_full()) {
    cond_wait(&producer_CV, &lock);
}
enqueue(item);
cond_signal(&consumer_CV);
```

### 原子读-改-写：`test_and_set`

```c
int test_and_set(int *addr);
```

- `addr`：锁变量地址。
- 语义：原子读取旧值，并把 `*addr` 设置为 `1`。
- 返回：旧值。旧值为 `0` 表示本次拿到锁。

```c
int value = 0;

void Acquire(void) {
    while (test_and_set(&value)) {
        /* spin */
    }
}

void Release(void) {
    value = 0;
}
```

### 原子交换：`swap`

```c
void swap(int *addr, int *reg);
```

- `addr`：内存地址。
- `reg`：寄存器/局部变量地址。
- 语义：原子交换 `*addr` 与 `*reg`。

```c
int key = 1;
while (key != 0) {
    swap(&lock_value, &key);
}
```

### 比较并交换：`compare_and_swap`

```c
int compare_and_swap(int *addr, int expected, int new_value);
```

- `addr`：内存地址。
- `expected`：期望旧值。
- `new_value`：要写入的新值。
- 语义：若 `*addr == expected`，则把 `*addr` 改成 `new_value` 并返回成功；否则不修改。

```c
while (!compare_and_swap(&lock_value, 0, 1)) {
    /* spin */
}
```

### `load` / `store`

```c
int load(int *addr);
void store(int *addr, int value);
```

- 普通读写在单独一步上可能是原子的，但无法表达“检查并修改”的整体原子性。
- 课件用它们说明为什么仅靠普通读写实现不了可靠锁。

```c
if (load(&lock_value) == 0) {
    store(&lock_value, 1);  // 这两步合起来不是原子的
}
```

### 调度循环伪 API

```c
void RunThread(void);
TCB *ChooseNextThread(void);
void SaveStateOfCPU(TCB *curTCB);
void LoadStateOfCPU(TCB *newTCB);
```

- `RunThread`：运行当前线程，直到它阻塞、让出 CPU 或被中断。
- `ChooseNextThread`：从 ready queue 选择下一个线程。
- `SaveStateOfCPU`：保存当前寄存器、PC、SP 等到旧 TCB。
- `LoadStateOfCPU`：从新 TCB 恢复 CPU 状态。

```c
for (;;) {
    RunThread();
    TCB *next = ChooseNextThread();
    SaveStateOfCPU(curTCB);
    LoadStateOfCPU(next);
}
```

### `Switch`

```c
void Switch(int tCur, int tNew);
```

- `tCur`：当前线程编号或 TCB 索引。
- `tNew`：下一个线程编号或 TCB 索引。
- 语义：保存旧线程寄存器/栈指针/返回 PC，恢复新线程对应状态。

```c
Switch(current_tid, next_tid);
```

### `yield`

```c
void yield(void);
```

- 参数：无。
- 语义：当前线程自愿让出 CPU，控制权回到调度器。

```c
while (!done) {
    do_some_work();
    yield();
}
```

### `run_new_thread`

```c
void run_new_thread(void);
```

- 参数：无。
- 语义：调度器或中断路径中选择并切换到新线程。

```c
void TimerInterrupt(void) {
    DoPeriodicHousekeeping();
    run_new_thread();
}
```

### `ThreadRoot`

```c
void ThreadRoot(void (*fcnPtr)(void *), void *fcnArgPtr);
```

- `fcnPtr`：用户线程函数。
- `fcnArgPtr`：传给用户函数的参数。
- 语义：新线程真正开始执行前的运行时入口，负责启动处理、进入用户态、调用用户函数、统一收尾。

```c
void ThreadRoot(void (*fcnPtr)(void *), void *arg) {
    DoStartupHousekeeping();
    UserModeSwitch();
    fcnPtr(arg);
    ThreadFinish();
}
```

### 事件驱动 ATM 示例回调

```c
void StartOnRequest(Request *req);
void ContinueRequest(Request *req, State *state);
void FinishRequest(Request *req, State *state);
```

- `StartOnRequest`：收到请求后启动第一阶段处理。
- `ContinueRequest`：I/O 完成或事件到达后继续。
- `FinishRequest`：完成请求并返回结果。
- 这些函数说明事件驱动会把顺序逻辑拆成多个状态机片段。

```c
void StartOnRequest(Request *req) {
    issue_async_read(req->acct_id);
}

void ContinueRequest(Request *req, State *state) {
    state->balance += req->amount;
    issue_async_write(state);
}

void FinishRequest(Request *req, State *state) {
    send_reply(req, state->balance);
}
```

## 11. 常量、类型与考试高频语义

### 标准流与文件描述符

- `stdin`、`stdout`、`stderr`：C 标准流。
- `STDIN_FILENO == 0`
- `STDOUT_FILENO == 1`
- `STDERR_FILENO == 2`

```c
fprintf(stderr, "error\n");
write(STDERR_FILENO, "error\n", 6);
```

### 文件定位常量

- `SEEK_SET`：从文件开头算偏移。
- `SEEK_CUR`：从当前位置算偏移。
- `SEEK_END`：从文件末尾算偏移。

```c
lseek(fd, 0, SEEK_END);
```

### 打开标志与权限位

- `O_RDONLY`：只读。
- `O_WRONLY`：只写。
- `O_RDWR`：读写。
- `O_CREAT`：不存在则创建。
- `O_TRUNC`：打开时截断。
- `S_IRUSR`：用户可读。
- `S_IWUSR`：用户可写。

```c
open("x.txt", O_WRONLY | O_CREAT | O_TRUNC, S_IRUSR | S_IWUSR);
```

### 信号与错误

- `SIGINT`：常由 Ctrl-C 触发。
- `SIGPIPE`：向没有读端的 pipe 或断开的连接写入时可能触发。
- `EPIPE`：忽略/处理 `SIGPIPE` 后，`write` 可能以该错误失败。
- `errno`：保存最近一次系统调用/库函数失败的错误码。

```c
if (write(fd, buf, n) < 0) {
    if (errno == EPIPE) {
        /* reader disappeared */
    }
}
```

### 常见类型

- `pid_t`：进程 ID。
- `pthread_t`：线程 ID。
- `pthread_attr_t`：线程属性。
- `pthread_mutex_t`：pthread 互斥锁。
- `pthread_cond_t`：pthread 条件变量。
- `sem_t`：POSIX 信号量。
- `ssize_t`：有符号字节计数，允许返回 `-1`。
- `size_t`：无符号大小。
- `off_t`：文件偏移。
- `mode_t`：文件权限位。
- `socklen_t`：socket 地址长度。
