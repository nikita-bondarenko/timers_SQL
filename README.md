# timers_SQL

### Project setup
```
npm install
```
### Compiles and hot-reloads for development
``` 
npm run serve
``` 

In this application, you can create your own user, start and stop timers.

An important point: to prevent conflict between the Vue and Nunjucks syntaxes, the latest sentiment is to use square brackets instead of curly braces for server-side templates:
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


