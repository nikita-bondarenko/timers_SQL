Клиентский код идентичен части noauth.
API точно так же работают по AJAX.

Шаблон index.njk отличается, его нужно изучить.

Регистрация /signup и аутентификция /login работают через «обычную» отпраку формы, см. шаблон.

Важный момент: для того чтобы избежать конфликта между синтаксисом Vue и Nunjucks последние настроены так, что для серверных шаблонов вместо фигурных скобок используются квадратные:

```js
  tags: {
    blockStart: "[%",
    blockEnd: "%]",
    variableStart: "[[",
    variableEnd: "]]",
    commentStart: "[#",
    commentEnd: "#]",
  },
```
# timers_SQL
