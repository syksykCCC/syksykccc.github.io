**2.5** 
A. `21` `87`
B. `21 43` `87 65`
C. `21 43 65` `87 65 43`

**2.6**
A. 
`0x00359141` = `0b00000000001101011001000101000001`
`0x4A564504` = `..0b01001010010101100100010100000100`
B. 21 位匹配
C. 从 `int` 的第一个 1 的后一位开始匹配直到结束

**2.7**
`61 62 63 64 65 66`

**2.10**
`a  b^a`
`b  b^a`
`b  a`

**2.11**
A. `k + 1`
B. `&a[first] = &a[last]`，从而两个其实用的是同一个地址
C. `first < last`

**2.12**
A. `x & 0xFF`
B. `(~x) ^ 0xFF`
C. `x | 0xFF`

**2.13**
`bis(x, y)`
`bis(bic(bis(x, y), y), bic(bis(x, y), x))`

**2.15**
`~ (x ^ y)`

**2.21**
无符号，1
有符号，1
无符号，0，`-2147483647 - 1U = 2147483648U`
有符号，1
无符号，1，`(unsigned)(-2147483647) = 2147483649U`

**2.23**
`0x00000076 0x00000076`
`0x00000021 0x00000021`
`0x000000C9 0xFFFFFFC9`
`0x00000087 0xFFFFFF87`

**2.25**
`length - 1 = UINT_MAX`，从而导致访问无效内存

**2.26**
A. `strlen(s) < strlen(t)` 会发生错误
B. 因为溢出为极大值，依然 > 0
C. 修改为 `return strlen(s) > strlen(t)`

**2.27**
```c
int uadd_ok(unsigned x, unsigned y) {
  return x + y > x;
}
```

**2.30**
```c
int tadd_ok(int x, int y) {
  int s = x + y;
  if(x > 0 && y > 0) return s > 0;
  if(x < 0 && y < 0) return s < 0;
  return 1;
}
```

**2.31**
由于补码的加法构成 Abel 群，所以这个函数一直返回 1

**2.32**
`x = y = INT_MIN`

**2.35**
`x * y = p + t * 2^w`，其中 `t != 0` 当且仅当溢出。
而 `p = x * q + r`，其中 `0 <= r < x`，故 `p / x = q`。
`q = y` 成立时当且仅当 `r = t = 0`，也就是没有发生溢出。

**2.36**
```c
int tmult_ok(int x, int y) {
  int64_t p = (int64_t)x * y;
  return INT_MIN <= p && p <= INT_MAX;
}
```

**2.37**
A. 乘法过程不会发生溢出
B. `if(asize > UINT_MAX) return NULL;` 如果产生溢出就分配失败。

**2.39**
直接 `- (x << m)`

**2.40**
`(x << 2) + (x << 1)`
`(x << 5) - x`
`(x << 1) - (x << 3)`
`(x << 6) - (x << 3) - x`

**2.41**
如果 `n = m` 则用第一种，`n = m + 1` 都可以，否则用第二种

**2.42**
```c
int div16(int x) {
  int t = x >> 31 & 1;
  return ((t << 4) - t + x) >> 4;
}
```

**2.43**
`M = 31`，`N = 8`

**2.59**
```c
x & 0xFF | (y >> 2 << 2)
```

**2.60**
```c
unsigned replace_byte(unsigned x, int i, unsigned char b) {
  unsigned h = x >> ((i + 1) << 3);
  unsigned l = x & ((1u << (i << 3)) - 1);
  return (h << 8 | b) << (i << 3) | l;
}
```

**2.71**
```c
int xbyte(packed_t word, int bytenum) {
  unsigned t = ((word >> (bytenum << 3)) << 24 >> 24);
  return (t - ((t << 24 >> 31 << 8)));
}
```