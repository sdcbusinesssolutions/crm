TOKEN='EAAO4J3qeOYUBQZAaEzaUSHXuxYgiZCJnyBDtI0bZAKNP29Y49YQbF3NR49QKqgKM10gaAc4VBoDZAT5DSzM26Cmal0USGCOCMQ9StuYDgQQmZCXYKzU1HOxJc3MyHHWx8m34Wg2v4Lrqs851fW5kInTgiZCAbvZCS0D5Psx4uA3qt78mXflaDrLQZBAF1cDWohcFuuZArnT6r6BfOUxkzymYyQRmzZCHIbXtyay9MlkZB8V7VDOoQtZAfh6cAJYSnxVtiDaVB7Opr2tFaYShF7tv7k8YDtU0pkbHbQxb'
MID='2400945497033453'
JSON=$(docker exec clickube_com-whatsapp-app-1 curl -s -H "Authorization: Bearer $TOKEN" "https://graph.facebook.com/v21.0/$MID")
URL=$(echo $JSON | sed -n 's/.*"url":"\([^"]*\)".*/\1/p' | sed 's/\\//g')
SIZE=$(echo $JSON | sed -n 's/.*"file_size":\([0-9]*\).*/\1/p')

echo "Metadata Size: $SIZE"
echo "--- TESTING IPv4 --- "
docker exec clickube_com-whatsapp-app-1 curl -v -s -L -4 -w '\nREMOTE_IP:%{remote_ip}\nHTTP_CODE:%{http_code}\nSIZE_DOWNLOAD:%{size_download}\n' -H "Authorization: Bearer $TOKEN" -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36" "$URL" -o /dev/null 2>&1 | tail -n 20

echo -e "\n--- TESTING IPv6 --- "
docker exec clickube_com-whatsapp-app-1 curl -v -s -L -6 -w '\nREMOTE_IP:%{remote_ip}\nHTTP_CODE:%{http_code}\nSIZE_DOWNLOAD:%{size_download}\n' -H "Authorization: Bearer $TOKEN" -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36" "$URL" -o /dev/null 2>&1 | tail -n 20
