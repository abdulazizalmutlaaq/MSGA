/* MSGA — حارس المستندات
   يخفي الصفحة ويتحقق من تسجيل الدخول قبل عرض المحتوى.
   يسمح فقط بالحسابات الموجودة في ALLOW. غيرها يُعاد توجيهه لصفحة الدخول. */
(function () {
  // الحسابات المصرّح لها بفتح المستندات (أضف/احذف إيميلات حسب الحاجة)
  var ALLOW = [
    'agflka123@gmail.com',   // الأدمن
    'a.almutlaq@msga.co'     // عبدالعزيز المطلق — الموارد البشرية
  ];

  var FB = {
    apiKey: "AIzaSyAnb5GVs9VVLwAHNPZwziKY0C6mnNYRRJA",
    authDomain: "msga-mom.firebaseapp.com",
    projectId: "msga-mom",
    storageBucket: "msga-mom.firebasestorage.app",
    messagingSenderId: "462364655283",
    appId: "1:462364655283:web:9b1b876a078c32d68e3ac6"
  };

  // إخفاء الصفحة فوراً حتى نتأكد من الهوية
  var hide = document.createElement('style');
  hide.id = '__guard_hide';
  hide.textContent = 'html{visibility:hidden!important}';
  (document.head || document.documentElement).appendChild(hide);

  function reveal() { var e = document.getElementById('__guard_hide'); if (e) e.remove(); }
  function deny() { location.replace('momfirebase.html'); }

  function load(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  load('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js')
    .then(function () { return load('https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js'); })
    .then(function () {
      firebase.initializeApp(FB);
      firebase.auth().onAuthStateChanged(function (user) {
        if (user && ALLOW.indexOf((user.email || '').toLowerCase()) >= 0) reveal();
        else deny();
      });
    })
    .catch(deny);

  // أمان إضافي: لو ما تحقق شي خلال 8 ثوانٍ، أعد التوجيه
  setTimeout(function () { if (document.getElementById('__guard_hide')) deny(); }, 8000);
})();
