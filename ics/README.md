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


**2.71**
```c
int xbyte(packed_t word, int bytenum) {
  unsigned t = ((word >> (bytenum << 3)) << 24 >> 24) ;
  return (t - ((t << 24 >> 31 << 8)));
}
```