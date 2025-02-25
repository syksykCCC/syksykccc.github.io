<div align="center">

<!-- 标题动态背景 -->
<div style="
  background: linear-gradient(135deg, #0f0f0f 30%, #1a1a2e 100%);
  padding: 2rem;
  border-radius: 16px;
  margin-bottom: 2rem;
  position: relative;
  overflow: hidden;
">
  <div style="
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(
      45deg,
      rgba(100, 255, 218, 0.1) 25%,
      transparent 25%,
      transparent 50%,
      rgba(100, 255, 218, 0.1) 50%,
      rgba(100, 255, 218, 0.1) 75%,
      transparent 75%
    );
    background-size: 4px 4px;
    transform: rotate(30deg);
    z-index: 0;
  "></div>
  
  <h1 style="
    position: relative;
    color: #64ffda;
    font-size: 2.5em;
    text-shadow: 0 0 10px rgba(100, 255, 218, 0.5);
    z-index: 1;
  ">2025 Spring 随机算法 学习笔记</h1>
</div>

<!-- 课程卡片容器 -->
<div style="
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
">
  <!-- Lecture 1 -->
  <div style="
    background: linear-gradient(145deg, #1a1a2e 0%, #0f0f0f 100%);
    border-radius: 12px;
    padding: 1.5rem;
    transition: transform 0.3s ease;
    border: 1px solid rgba(100, 255, 218, 0.2);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  " onmouseover="this.style.transform='translateY(-5px)'" 
  onmouseout="this.style.transform='none'">
    <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
      <svg width="24" height="24" viewBox="0 0 24 24" style="fill: #64ffda;">
        <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z"></path>
        <path d="M13 7h-2v6h6v-2h-4z"></path>
      </svg>
      <h3 style="color: #64ffda; margin: 0;">Lecture 1</h3>
      <span style="color: #8892b0; font-size: 0.9em;">2025/2/17</span>
    </div>
    <div style="
      background: rgba(100, 255, 218, 0.1);
      padding: 0.5rem 1rem;
      border-radius: 20px;
      margin-bottom: 1rem;
      display: inline-block;
    ">
      <span style="color: #64ffda;">📌 核心主题</span>
    </div>
    <ul style="
      color: #ccd6f6;
      list-style: none;
      padding-left: 0;
      margin: 0;
    ">
      <li style="padding: 0.5rem 0; border-bottom: 1px solid rgba(100, 255, 218, 0.1);">
        Matrix multiplication
      </li>
      <li style="padding: 0.5rem 0; border-bottom: 1px solid rgba(100, 255, 218, 0.1);">
        Associativity
      </li>
      <li style="padding: 0.5rem 0;">
        Polynomial identities
      </li>
    </ul>
    <a href="Lec1.html" style="
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 1rem;
      padding: 0.5rem 1.5rem;
      background: linear-gradient(45deg, #64ffda, #00b4d8);
      color: #0a192f;
      border-radius: 25px;
      text-decoration: none;
      font-weight: bold;
      transition: box-shadow 0.3s ease;
    " onmouseover="this.style.boxShadow='0 0 15px rgba(100, 255, 218, 0.5)'" 
    onmouseout="this.style.boxShadow='none'">
      <svg width="16" height="16" viewBox="0 0 24 24" style="fill: #0a192f;">
        <path d="M5 12h14M12 5l7 7-7 7"></path>
      </svg>
      查看笔记
    </a>
  </div>

  <!-- Lecture 2 -->
  <div style="
    background: linear-gradient(145deg, #1a1a2e 0%, #0f0f0f 100%);
    border-radius: 12px;
    padding: 1.5rem;
    transition: transform 0.3s ease;
    border: 1px solid rgba(100, 255, 218, 0.2);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  " onmouseover="this.style.transform='translateY(-5px)'" 
  onmouseout="this.style.transform='none'">
    <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
      <svg width="24" height="24" viewBox="0 0 24 24" style="fill: #64ffda;">
        <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z"></path>
        <path d="M13 7h-2v6h6v-2h-4z"></path>
      </svg>
      <h3 style="color: #64ffda; margin: 0;">Lecture 2</h3>
      <span style="color: #8892b0; font-size: 0.9em;">2025/2/20</span>
    </div>
    <div style="
      background: rgba(100, 255, 218, 0.1);
      padding: 0.5rem 1rem;
      border-radius: 20px;
      margin-bottom: 1rem;
      display: inline-block;
    ">
      <span style="color: #64ffda;">📌 核心主题</span>
    </div>
    <ul style="
      color: #ccd6f6;
      list-style: none;
      padding-left: 0;
      margin: 0;
    ">
      <li style="padding: 0.5rem 0; border-bottom: 1px solid rgba(100, 255, 218, 0.1);">
        Bipartite matching
      </li>
      <li style="padding: 0.5rem 0; border-bottom: 1px solid rgba(100, 255, 218, 0.1);">
        Perfect matching in parallel
      </li>
      <li style="padding: 0.5rem 0;">
        Fingerprinting
      </li>
    </ul>
    <a href="Lec2.html" style="
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 1rem;
      padding: 0.5rem 1.5rem;
      background: linear-gradient(45deg, #64ffda, #00b4d8);
      color: #0a192f;
      border-radius: 25px;
      text-decoration: none;
      font-weight: bold;
      transition: box-shadow 0.3s ease;
    " onmouseover="this.style.boxShadow='0 0 15px rgba(100, 255, 218, 0.5)'" 
    onmouseout="this.style.boxShadow='none'">
      <svg width="16" height="16" viewBox="0 0 24 24" style="fill: #0a192f;">
        <path d="M5 12h14M12 5l7 7-7 7"></path>
      </svg>
      查看笔记
    </a>
  </div>

  <!-- Lecture 3 -->
  <div style="
    background: linear-gradient(145deg, #1a1a2e 0%, #0f0f0f 100%);
    border-radius: 12px;
    padding: 1.5rem;
    transition: transform 0.3s ease;
    border: 1px solid rgba(100, 255, 218, 0.2);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  " onmouseover="this.style.transform='translateY(-5px)'" 
  onmouseout="this.style.transform='none'">
    <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
      <svg width="24" height="24" viewBox="0 0 24 24" style="fill: #64ffda;">
        <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z"></path>
        <path d="M13 7h-2v6h6v-2h-4z"></path>
      </svg>
      <h3 style="color: #64ffda; margin: 0;">Lecture 3</h3>
      <span style="color: #8892b0; font-size: 0.9em;">2025/2/24</span>
    </div>
    <div style="
      background: rgba(100, 255, 218, 0.1);
      padding: 0.5rem 1rem;
      border-radius: 20px;
      margin-bottom: 1rem;
      display: inline-block;
    ">
      <span style="color: #64ffda;">📌 核心主题</span>
    </div>
    <ul style="
      color: #ccd6f6;
      list-style: none;
      padding-left: 0;
      margin: 0;
    ">
      <li style="padding: 0.5rem 0; border-bottom: 1px solid rgba(100, 255, 218, 0.1);">
        Primality
      </li>
      <li style="padding: 0.5rem 0; border-bottom: 1px solid rgba(100, 255, 218, 0.1);">
        Probabilistic method
      </li>
      <li style="padding: 0.5rem 0; border-bottom: 1px solid rgba(100, 255, 218, 0.1);">
        Independent set
      </li>
      <li style="padding: 0.5rem 0;">
        crossing number
      </li>
    </ul>
    <a href="Lec3.html" style="
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 1rem;
      padding: 0.5rem 1.5rem;
      background: linear-gradient(45deg, #64ffda, #00b4d8);
      color: #0a192f;
      border-radius: 25px;
      text-decoration: none;
      font-weight: bold;
      transition: box-shadow 0.3s ease;
    " onmouseover="this.style.boxShadow='0 0 15px rgba(100, 255, 218, 0.5)'" 
    onmouseout="this.style.boxShadow='none'">
      <svg width="16" height="16" viewBox="0 0 24 24" style="fill: #0a192f;">
        <path d="M5 12h14M12 5l7 7-7 7"></path>
      </svg>
      查看笔记
    </a>
  </div>

</div>

<!-- 更新提示 -->
<div style="
  margin-top: 2rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-left: 4px solid #64ffda;
  border-radius: 4px;
">
  <p style="color: #ccd6f6; margin: 0;">
    🚀 本笔记持续更新中，欢迎催更
  </p>
</div>
</div>