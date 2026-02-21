const { execFile } = require('child_process');

const url = 'https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1225233163074832&source=getMedia&ext=1771701918&hash=ARl4UzP8kQX_qBMZQ_nfcdndbKmB9MXED8BfRelVw8i2WQ';
const token = 'EAAO4J3qeOYUBQZAaEzaUSHXuxYgiZCJnyBDtI0bZAKNP29Y49YQbF3NR49QKqgKM10gaAc4VBoDZAT5DSzM26Cmal0USGCOCMQ9StuYDgQQmZCXYKzU1HOxJc3MyHHWx8m34Wg2v4Lrqs851fW5kInTgiZCAbvZCS0D5Psx4uA3qt78mXflaDrLQZBAF1cDWohcFuuZArnT6r6BfOUxkzymYyQRmzZCHIbXtyay9MlkZB8V7VDOoQtZAfh6cAJYSnxVtiDaVB7Opr2tFaYShF7tv7k8YDtU0pkbHbQxb';

const args = [
    '--verbose',
    '--fail',
    '--location',
    '--max-time', '60',
    '-H', `Authorization: Bearer ${token}`,
    '-H', 'User-Agent: WhatsApp/2.21.11.17 A',
    '-H', 'Accept: */*',
    url
];

execFile('curl', args, { encoding: null }, (error, stdout, stderr) => {
    console.log('--- ERROR ---');
    console.log(error);
    console.log('--- STDERR ---');
    console.log(stderr ? stderr.toString() : 'NONE');
    console.log('--- STDOUT LENGTH ---');
    console.log(stdout ? stdout.length : 0);
});
