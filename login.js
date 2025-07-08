// 等待页面加载完成
document.addEventListener('DOMContentLoaded', function() {
  // 获取表单元素
  const form = document.querySelector('form');
  
  // 监听表单提交事件
  form.addEventListener('submit', function(event) {
      // 阻止表单默认提交行为
      event.preventDefault();
      
      // 获取输入的用户名和密码
      const username = document.getElementById('input1').value;
      const password = document.getElementById('input2').value;
      
      // 检查用户名和密码是否正确
      if (username === '名字' && password === '123456') {
          // 登录成功，跳转到目标页面
          window.location.href = 'qishiye/index.html';
      } else {
          // 登录失败，显示错误提示
          alert('名字或密码不正确！');
      }
  });
});