document.addEventListener('DOMContentLoaded', function() {
  // 获取元素
  const input1 = document.getElementById('input1');
  const input2 = document.getElementById('input2');
  const button = document.querySelector('.button');
  const loginPage = document.querySelector('.login-container');
  const welcomePage = document.getElementById('welcomePage');

  // 登录按钮点击事件
  button.addEventListener('click', function() {
    if (input1.value.trim() === '名字' && input2.value.trim() === '123456') {
      // 登录成功：隐藏登录页，显示欢迎页
      loginPage.style.display = 'none';
      welcomePage.style.display = 'block';
      document.body.style.overflow = 'auto'; // 恢复滚动条
    } else {
      alert('密码或名字不正确');
    }
  });
});