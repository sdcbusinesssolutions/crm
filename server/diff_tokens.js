
const promptToken = 'EAAO4J3qeOYUBZAaEzaUSHXuxYgiZCJnyBDtI0bZAKNP29Y49YQbF3NR49QKqgKM10gaAc4VBoDZAT5DSzM26Cmal0USGCOCMQ9StuYDgQQmZCXYKzU1HOxJc3MyHHWx8m34Wg2v4Lrqs851fW5kInTgiZCAbvZCS0D5Psx4uA3qt78mXflaDrLQZBAF1cDWohcFuuZArnT6r6BfOUxkzymYyQRmzZCHIbXtyay9MlkZB8V7VDOoQtZAfh6cAJYSnxVtiDaVB7Opr2tFaYShF7tv7k8YDtU0pkbHbQxb';
const dbConfig = require('./config_dump.json');
const dbToken = dbConfig.token;

for (let i = 0; i < Math.max(promptToken.length, dbToken.length); i++) {
    if (promptToken[i] !== dbToken[i]) {
        console.log(`Diff at index ${i}: Prompt='${promptToken[i]}' DB='${dbToken[i]}'`);
        break;
    }
}
