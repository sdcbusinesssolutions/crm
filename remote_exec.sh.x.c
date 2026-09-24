#if 0
	shc Version 4.0.3, Generic Shell Script Compiler
	GNU GPL Version 3 Md Jahidul Hamid <jahidulhamid@yahoo.com>

	shc -r -f remote_exec.sh -o remote_exec.bin 
#endif

static  char data [] = 
#define      inlo_z	3
#define      inlo	((&data[0]))
	"\173\002\360"
#define      date_z	1
#define      date	((&data[3]))
	"\043"
#define      tst1_z	22
#define      tst1	((&data[4]))
	"\222\163\114\030\270\155\044\026\124\304\045\230\205\100\353\112"
	"\033\225\012\223\255\145"
#define      chk2_z	19
#define      chk2	((&data[27]))
	"\020\227\325\004\322\176\217\227\350\377\141\305\331\236\221\126"
	"\231\375\255\156\176"
#define      msg1_z	65
#define      msg1	((&data[50]))
	"\037\135\043\303\320\212\122\143\215\126\377\063\025\075\245\316"
	"\230\063\211\035\342\333\114\361\361\373\002\374\135\275\252\001"
	"\336\337\052\017\166\366\050\053\224\031\207\372\361\330\070\306"
	"\162\075\117\275\276\212\142\227\125\151\140\346\365\000\257\203"
	"\273\223\261\160\016\341\163"
#define      chk1_z	22
#define      chk1	((&data[122]))
	"\175\244\374\146\160\366\126\121\023\314\153\277\262\377\331\363"
	"\150\115\210\372\065\064\152\016\235\265\061"
#define      xecc_z	15
#define      xecc	((&data[145]))
	"\135\055\347\331\176\307\140\357\153\300\001\335\063\266\335"
#define      lsto_z	1
#define      lsto	((&data[160]))
	"\155"
#define      pswd_z	256
#define      pswd	((&data[189]))
	"\336\313\013\357\111\053\040\174\112\176\240\131\140\024\340\051"
	"\141\135\316\136\304\377\243\345\046\023\077\315\312\302\254\065"
	"\232\135\235\234\327\012\023\225\171\000\225\005\013\016\122\017"
	"\335\334\317\200\247\014\020\204\124\156\121\036\060\376\124\312"
	"\133\362\147\062\375\173\310\166\173\136\173\206\155\315\225\112"
	"\252\145\312\121\161\333\325\306\111\047\344\172\045\071\105\200"
	"\053\254\263\050\047\174\237\243\332\033\052\110\350\300\222\223"
	"\045\134\344\226\067\272\134\201\342\101\373\010\173\100\211\246"
	"\355\074\317\025\271\156\270\224\211\343\334\162\243\156\005\310"
	"\313\352\137\003\245\273\204\207\375\200\217\170\301\030\037\256"
	"\125\357\304\016\136\175\243\347\140\177\132\003\355\140\313\270"
	"\113\053\274\360\347\100\170\344\300\010\135\202\041\175\060\167"
	"\154\364\206\312\161\051\262\322\250\015\325\226\155\241\117\271"
	"\314\013\251\263\113\042\230\014\052\366\216\114\163\277\303\340"
	"\264\111\253\046\162\136\370\032\153\316\261\331\157\000\222\074"
	"\013\074\357\127\136\210\144\211\176\362\325\362\262\230\322\147"
	"\342\175\215\124\334\206\157\107\124\040\041\303\041\264\377\054"
	"\361\357\203\120\170\347\331\366\332\257\350\215\003\256\175\342"
	"\172\211\321\303\264\361\100\377\160\340\130\320\364\070\372\125"
	"\226\310\264\133\310\130\100\356\154\200\274\157\056\072\122\250"
	"\303\043\154\170\025\254\167\205"
#define      msg2_z	19
#define      msg2	((&data[493]))
	"\201\010\120\326\242\301\212\151\323\373\025\215\202\365\110\341"
	"\171\217\352\254\126\177\226\237"
#define      shll_z	10
#define      shll	((&data[514]))
	"\341\214\167\225\271\343\245\120\122\113\331\343\072"
#define      text_z	1230
#define      text	((&data[621]))
	"\214\277\351\306\021\221\212\065\376\002\112\252\171\320\067\111"
	"\046\270\121\167\217\361\220\032\353\161\376\046\101\116\341\316"
	"\015\312\225\037\134\037\124\132\041\236\005\233\156\075\344\225"
	"\365\066\014\205\047\234\240\022\016\236\071\117\354\032\036\372"
	"\344\263\031\101\322\155\234\364\014\242\220\173\337\164\020\324"
	"\253\035\131\322\271\371\345\307\230\036\027\205\070\066\177\045"
	"\260\035\237\246\325\267\133\360\050\032\076\211\050\117\017\241"
	"\060\127\346\376\366\050\251\124\372\321\336\365\251\074\032\322"
	"\106\141\127\335\325\132\130\354\301\131\165\323\136\135\116\370"
	"\250\233\145\106\120\370\261\230\234\364\375\130\134\215\075\333"
	"\350\056\307\061\365\332\077\301\164\046\373\224\162\202\023\352"
	"\321\330\324\020\025\230\371\235\347\005\202\233\050\160\032\325"
	"\043\010\341\254\341\226\160\070\154\022\340\140\207\016\363\170"
	"\225\126\240\345\157\356\157\275\004\220\277\132\336\164\054\157"
	"\163\332\317\073\153\001\057\045\014\226\042\200\201\072\131\065"
	"\313\360\042\016\323\347\275\240\363\145\065\340\003\001\000\115"
	"\157\333\342\133\117\353\156\040\347\314\176\377\227\150\244\221"
	"\363\036\102\131\214\377\022\205\342\355\053\165\015\106\134\377"
	"\311\111\214\175\030\331\125\315\343\305\103\170\132\316\004\256"
	"\014\226\135\301\133\167\111\162\300\164\056\226\252\160\356\342"
	"\367\260\257\161\063\331\216\235\152\046\345\120\261\041\344\024"
	"\016\222\004\040\010\357\073\304\123\105\024\046\203\176\225\372"
	"\014\340\334\233\157\153\203\334\241\375\261\265\002\333\103\055"
	"\300\076\333\330\077\377\073\345\136\022\154\205\062\321\300\164"
	"\335\335\125\243\050\014\311\212\133\066\227\014\062\277\261\176"
	"\156\112\027\245\116\206\175\154\165\357\123\252\210\021\141\105"
	"\245\110\272\037\237\024\223\116\226\171\353\130\036\330\156\323"
	"\166\306\110\023\046\232\016\064\233\331\134\157\326\242\110\150"
	"\060\350\174\012\267\074\134\131\062\270\206\304\373\131\115\060"
	"\314\241\013\130\221\161\215\337\021\334\211\164\071\076\333\103"
	"\110\341\007\210\042\241\006\370\337\376\313\355\320\220\177\041"
	"\171\116\342\336\071\005\207\224\056\372\254\205\016\122\214\325"
	"\011\355\344\014\205\310\156\073\240\262\232\355\322\116\220\273"
	"\232\060\212\275\042\217\223\251\015\313\201\065\230\246\163\121"
	"\200\300\040\364\243\220\044\335\354\213\340\207\275\154\003\216"
	"\213\134\270\336\330\054\371\170\266\305\243\131\347\302\325\224"
	"\032\321\022\241\075\270\372\150\226\170\034\254\013\240\231\056"
	"\030\213\160\101\374\007\140\377\053\201\310\074\206\125\221\222"
	"\126\211\242\137\143\254\360\350\204\154\352\125\105\121\003\272"
	"\330\240\272\013\022\202\136\341\373\104\067\023\256\337\131\031"
	"\343\127\143\105\021\016\350\156\014\050\103\231\143\345\077\055"
	"\251\351\251\314\014\157\021\356\004\016\026\052\013\062\205\377"
	"\006\330\343\341\307\103\102\020\047\346\324\110\300\257\056\274"
	"\237\143\074\033\246\040\126\135\036\202\271\227\101\043\377\246"
	"\167\212\335\312\313\332\362\077\233\043\351\103\215\110\140\037"
	"\151\007\217\112\072\365\275\165\003\011\131\063\330\361\315\076"
	"\306\267\220\037\321\375\100\222\241\010\304\301\217\330\232\236"
	"\212\066\373\321\214\253\123\301\372\050\342\310\055\015\037\052"
	"\354\270\320\035\061\274\306\142\134\061\237\162\330\160\012\255"
	"\166\071\254\022\270\350\013\211\150\144\070\137\163\145\374\315"
	"\126\120\231\142\364\304\267\075\134\347\205\142\024\266\056\360"
	"\146\125\007\250\336\367\044\340\307\054\103\011\136\133\357\052"
	"\023\102\143\265\050\314\065\106\025\025\031\225\310\177\014\371"
	"\345\175\166\036\027\164\027\331\022\112\005\134\314\063\127\117"
	"\115\201\311\323\006\157\225\025\021\032\101\371\212\337\105\313"
	"\276\255\205\314\062\340\150\132\121\242\110\203\346\346\120\226"
	"\121\316\242\161\033\065\236\320\141\240\313\064\054\056\146\215"
	"\030\154\176\146\130\312\211\021\267\120\222\137\277\243\056\212"
	"\032\073\030\327\372\053\131\126\242\262\322\065\355\322\246\231"
	"\242\134\074\051\271\004\323\351\247\114\045\130\117\234\133\032"
	"\326\360\073\041\376\002\131\145\130\066\142\155\166\010\123\257"
	"\256\331\051\171\310\002\126\026\247\340\353\260\210\274\052\205"
	"\367\232\335\230\140\061\332\264\052\101\176\006\132\012\002\006"
	"\371\111\120\105\106\143\344\364\321\373\062\001\321\312\215\127"
	"\006\332\377\245\225\012\166\124\360\135\137\053\163\127\027\171"
	"\031\301\122\327\125\372\175\307\173\277\232\173\210\312\242\143"
	"\175\154\136\102\332\202\134\054\125\204\260\306\046\027\105\203"
	"\025\341\037\103\260\351\106\256\217\134\053\367\344\367\334\347"
	"\264\372\076\276\104\173\372\232\342\355\004\160\037\363\362\061"
	"\252\223\133\327\320\013\107\257\062\330\003\052\245\224\216\020"
	"\021\100\363\070\031\240\114\362\312\141\062\066\267\007\122\274"
	"\217\273\176\036\076\171\372\025\167\152\161\323\151\174\037\013"
	"\303\340\006\150\137\130\157\272\270\131\040\251\255\111\302\355"
	"\253\207\257\122\226\352\114\172\026\007\342\335\135\317\136\230"
	"\302\025\144\064\345\006\077\330\065\073\073\016\272\102\003\061"
	"\131\132\064\265\162\315\362\124\110\342\373\001\015\332\373\055"
	"\003\044\345\231\365\036\002\142\132\115\022\364\072\117\231\231"
	"\332\254\371\301\210\071\146\114\271\125\253\116\126\130\310\353"
	"\012\014\146\371\016\232\246\311\041\202\165\307\157\316\226\160"
	"\025\305\247\142\130\314\334\345\106\327\015\033\037\362\000\166"
	"\237\211\231\061\136\122\363\102\344\241\354\174\327\352\324\341"
	"\035\255\341\366\111\022\234\075\307\253\220\256\156\302\373\013"
	"\255\323\224\364\212\171\036\316\042\316\170\171\373\035\351\231"
	"\137\274\006\373\261\023\235\101\216\174\266\237\121\141\274\253"
	"\064\166\245\031\075\076\070\125\303\161\214\102\217\165\333\356"
	"\062\342\352\343\365\207\044\204\004\332\043\126\074\340\001\160"
	"\126\247\211\224\345\302\351\250\063\165\353\302\353\307\260\035"
	"\251\232\001\237\042\045\044\047\000\107\175\074\047\177\254\175"
	"\046\066\021\014\370\373\265\053\161\240\356\135\147\236\173\021"
	"\071\174\261\134\241\325\203\242\034\000\336\104\200\213\302\247"
	"\301\324\263\272\317\150\345\101\011\324\236\161\162\032\202\254"
	"\226\063\010\070\011\214\332\046\215\270\152\015\103\055\264\005"
	"\001\150\277\321\320\245\022\332\171\261\113\354\313\315\230\142"
	"\001\241\232\012\055\164\061\272\054\234\307\160\311\174\165\312"
	"\344\065\233\265\332\256\217\123\140\332\077\054\250\330\216\251"
	"\171\050\264\246\235\346\141\311\202\050\072\113\245\257\026\211"
	"\345\262\077\277\141\316\022\301\251\122\356\121\052"
#define      rlax_z	1
#define      rlax	((&data[2075]))
	"\215"
#define      opts_z	1
#define      opts	((&data[2076]))
	"\232"
#define      tst2_z	19
#define      tst2	((&data[2079]))
	"\014\027\006\136\166\170\355\150\101\144\262\044\272\324\271\066"
	"\164\263\326\225\364\324\106\143"/* End of data[] */;
#define      hide_z	4096
#define SETUID 0	/* Define as 1 to call setuid(0) at start of script */
#define DEBUGEXEC	0	/* Define as 1 to debug execvp calls */
#define TRACEABLE	1	/* Define as 1 to enable ptrace the executable */
#define HARDENING	0	/* Define as 1 to disable ptrace/dump the executable */
#define BUSYBOXON	0	/* Define as 1 to enable work with busybox */

#if HARDENING
static const char * shc_x[] = {
"/*",
" * Copyright 2019 - Intika <intika@librefox.org>",
" * Replace ******** with secret read from fd 21",
" * Also change arguments location of sub commands (sh script commands)",
" * gcc -Wall -fpic -shared -o shc_secret.so shc_secret.c -ldl",
" */",
"",
"#define _GNU_SOURCE /* needed to get RTLD_NEXT defined in dlfcn.h */",
"#define PLACEHOLDER \"********\"",
"#include <dlfcn.h>",
"#include <stdlib.h>",
"#include <string.h>",
"#include <unistd.h>",
"#include <stdio.h>",
"#include <signal.h>",
"",
"static char secret[128000]; //max size",
"typedef int (*pfi)(int, char **, char **);",
"static pfi real_main;",
"",
"// copy argv to new location",
"char **copyargs(int argc, char** argv){",
"    char **newargv = malloc((argc+1)*sizeof(*argv));",
"    char *from,*to;",
"    int i,len;",
"",
"    for(i = 0; i<argc; i++){",
"        from = argv[i];",
"        len = strlen(from)+1;",
"        to = malloc(len);",
"        memcpy(to,from,len);",
"        // zap old argv space",
"        memset(from,'\\0',len);",
"        newargv[i] = to;",
"        argv[i] = 0;",
"    }",
"    newargv[argc] = 0;",
"    return newargv;",
"}",
"",
"static int mymain(int argc, char** argv, char** env) {",
"    //fprintf(stderr, \"Inject main argc = %d\\n\", argc);",
"    return real_main(argc, copyargs(argc,argv), env);",
"}",
"",
"int __libc_start_main(int (*main) (int, char**, char**),",
"                      int argc,",
"                      char **argv,",
"                      void (*init) (void),",
"                      void (*fini)(void),",
"                      void (*rtld_fini)(void),",
"                      void (*stack_end)){",
"    static int (*real___libc_start_main)() = NULL;",
"    int n;",
"",
"    if (!real___libc_start_main) {",
"        real___libc_start_main = dlsym(RTLD_NEXT, \"__libc_start_main\");",
"        if (!real___libc_start_main) abort();",
"    }",
"",
"    n = read(21, secret, sizeof(secret));",
"    if (n > 0) {",
"      int i;",
"",
"    if (secret[n - 1] == '\\n') secret[--n] = '\\0';",
"    for (i = 1; i < argc; i++)",
"        if (strcmp(argv[i], PLACEHOLDER) == 0)",
"          argv[i] = secret;",
"    }",
"",
"    real_main = main;",
"",
"    return real___libc_start_main(mymain, argc, argv, init, fini, rtld_fini, stack_end);",
"}",
"",
0};
#endif /* HARDENING */

/* rtc.c */

#include <sys/stat.h>
#include <sys/types.h>

#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

/* 'Alleged RC4' */

static unsigned char stte[256], indx, jndx, kndx;

/*
 * Reset arc4 stte. 
 */
void stte_0(void)
{
	indx = jndx = kndx = 0;
	do {
		stte[indx] = indx;
	} while (++indx);
}

/*
 * Set key. Can be used more than once. 
 */
void key(void * str, int len)
{
	unsigned char tmp, * ptr = (unsigned char *)str;
	while (len > 0) {
		do {
			tmp = stte[indx];
			kndx += tmp;
			kndx += ptr[(int)indx % len];
			stte[indx] = stte[kndx];
			stte[kndx] = tmp;
		} while (++indx);
		ptr += 256;
		len -= 256;
	}
}

/*
 * Crypt data. 
 */
void arc4(void * str, int len)
{
	unsigned char tmp, * ptr = (unsigned char *)str;
	while (len > 0) {
		indx++;
		tmp = stte[indx];
		jndx += tmp;
		stte[indx] = stte[jndx];
		stte[jndx] = tmp;
		tmp += stte[indx];
		*ptr ^= stte[tmp];
		ptr++;
		len--;
	}
}

/* End of ARC4 */

#if HARDENING

#include <sys/ptrace.h>
#include <sys/wait.h>
#include <signal.h>
#include <sys/prctl.h>
#define PR_SET_PTRACER 0x59616d61

/* Seccomp Sandboxing Init */
#include <stdlib.h>
#include <stdio.h>
#include <stddef.h>
#include <string.h>
#include <unistd.h>
#include <errno.h>

#include <sys/types.h>
#include <sys/prctl.h>
#include <sys/syscall.h>
#include <sys/socket.h>

#include <linux/filter.h>
#include <linux/seccomp.h>
#include <linux/audit.h>

#define ArchField offsetof(struct seccomp_data, arch)

#define Allow(syscall) \
    BPF_JUMP(BPF_JMP+BPF_JEQ+BPF_K, SYS_##syscall, 0, 1), \
    BPF_STMT(BPF_RET+BPF_K, SECCOMP_RET_ALLOW)

struct sock_filter filter[] = {
    /* validate arch */
    BPF_STMT(BPF_LD+BPF_W+BPF_ABS, ArchField),
    BPF_JUMP( BPF_JMP+BPF_JEQ+BPF_K, AUDIT_ARCH_X86_64, 1, 0),
    BPF_STMT(BPF_RET+BPF_K, SECCOMP_RET_KILL),

    /* load syscall */
    BPF_STMT(BPF_LD+BPF_W+BPF_ABS, offsetof(struct seccomp_data, nr)),

    /* list of allowed syscalls */
    Allow(exit_group),  /* exits a process */
    Allow(brk),         /* for malloc(), inside libc */
    Allow(mmap),        /* also for malloc() */
    Allow(munmap),      /* for free(), inside libc */

    /* and if we don't match above, die */
    BPF_STMT(BPF_RET+BPF_K, SECCOMP_RET_KILL),
};
struct sock_fprog filterprog = {
    .len = sizeof(filter)/sizeof(filter[0]),
    .filter = filter
};

/* Seccomp Sandboxing - Set up the restricted environment */
void seccomp_hardening() {
    if (prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0)) {
        perror("Could not start seccomp:");
        exit(1);
    }
    if (prctl(PR_SET_SECCOMP, SECCOMP_MODE_FILTER, &filterprog) == -1) {
        perror("Could not start seccomp:");
        exit(1);
    }
} 
/* End Seccomp Sandboxing Init */

void shc_x_file() {
    FILE *fp;
    int line = 0;

    if ((fp = fopen("/tmp/shc_x.c", "w")) == NULL ) {exit(1); exit(1);}
    for (line = 0; shc_x[line]; line++)	fprintf(fp, "%s\n", shc_x[line]);
    fflush(fp);fclose(fp);
}

int make() {
	char * cc, * cflags, * ldflags;
    char cmd[4096];

	cc = getenv("CC");
	if (!cc) cc = "cc";

	sprintf(cmd, "%s %s -o %s %s", cc, "-Wall -fpic -shared", "/tmp/shc_x.so", "/tmp/shc_x.c -ldl");
	if (system(cmd)) {remove("/tmp/shc_x.c"); return -1;}
	remove("/tmp/shc_x.c"); return 0;
}

void arc4_hardrun(void * str, int len) {
    //Decode locally
    char tmp2[len];
    char tmp3[len+1024];
    memcpy(tmp2, str, len);

	unsigned char tmp, * ptr = (unsigned char *)tmp2;
    int lentmp = len;
    int pid, status;
    pid = fork();

    shc_x_file();
    if (make()) {exit(1);}

    setenv("LD_PRELOAD","/tmp/shc_x.so",1);

    if(pid==0) {

        //Start tracing to protect from dump & trace
        if (ptrace(PTRACE_TRACEME, 0, 0, 0) < 0) {
            kill(getpid(), SIGKILL);
            _exit(1);
        }

        //Decode Bash
        while (len > 0) {
            indx++;
            tmp = stte[indx];
            jndx += tmp;
            stte[indx] = stte[jndx];
            stte[jndx] = tmp;
            tmp += stte[indx];
            *ptr ^= stte[tmp];
            ptr++;
            len--;
        }

        //Do the magic
        sprintf(tmp3, "%s %s", "'********' 21<<<", tmp2);

        //Exec bash script //fork execl with 'sh -c'
        system(tmp2);

        //Empty script variable
        memcpy(tmp2, str, lentmp);

        //Clean temp
        remove("/tmp/shc_x.so");

        //Sinal to detach ptrace
        ptrace(PTRACE_DETACH, 0, 0, 0);
        exit(0);
    }
    else {wait(&status);}

    /* Seccomp Sandboxing - Start */
    seccomp_hardening();

    exit(0);
}
#endif /* HARDENING */

/*
 * Key with file invariants. 
 */
int key_with_file(char * file)
{
	struct stat statf[1];
	struct stat control[1];

	if (stat(file, statf) < 0)
		return -1;

	/* Turn on stable fields */
	memset(control, 0, sizeof(control));
	control->st_ino = statf->st_ino;
	control->st_dev = statf->st_dev;
	control->st_rdev = statf->st_rdev;
	control->st_uid = statf->st_uid;
	control->st_gid = statf->st_gid;
	control->st_size = statf->st_size;
	control->st_mtime = statf->st_mtime;
	control->st_ctime = statf->st_ctime;
	key(control, sizeof(control));
	return 0;
}

#if DEBUGEXEC
void debugexec(char * sh11, int argc, char ** argv)
{
	int i;
	fprintf(stderr, "shll=%s\n", sh11 ? sh11 : "<null>");
	fprintf(stderr, "argc=%d\n", argc);
	if (!argv) {
		fprintf(stderr, "argv=<null>\n");
	} else { 
		for (i = 0; i <= argc ; i++)
			fprintf(stderr, "argv[%d]=%.60s\n", i, argv[i] ? argv[i] : "<null>");
	}
}
#endif /* DEBUGEXEC */

void rmarg(char ** argv, char * arg)
{
	for (; argv && *argv && *argv != arg; argv++);
	for (; argv && *argv; argv++)
		*argv = argv[1];
}

void chkenv_end(void);

int chkenv(int argc)
{
	char buff[512];
	unsigned long mask, m;
	int l, a, c;
	char * string;
	extern char ** environ;

	mask = (unsigned long)getpid();
	stte_0();
	 key(&chkenv, (void*)&chkenv_end - (void*)&chkenv);
	 key(&data, sizeof(data));
	 key(&mask, sizeof(mask));
	arc4(&mask, sizeof(mask));
	sprintf(buff, "x%lx", mask);
	string = getenv(buff);
#if DEBUGEXEC
	fprintf(stderr, "getenv(%s)=%s\n", buff, string ? string : "<null>");
#endif
	l = strlen(buff);
	if (!string) {
		/* 1st */
		sprintf(&buff[l], "=%lu %d", mask, argc);
		putenv(strdup(buff));
		return 0;
	}
	c = sscanf(string, "%lu %d%c", &m, &a, buff);
	if (c == 2 && m == mask) {
		/* 3rd */
		rmarg(environ, &string[-l - 1]);
		return 1 + (argc - a);
	}
	return -1;
}

void chkenv_end(void){}

#if HARDENING

static void gets_process_name(const pid_t pid, char * name) {
	char procfile[BUFSIZ];
	sprintf(procfile, "/proc/%d/cmdline", pid);
	FILE* f = fopen(procfile, "r");
	if (f) {
		size_t size;
		size = fread(name, sizeof (char), sizeof (procfile), f);
		if (size > 0) {
			if ('\n' == name[size - 1])
				name[size - 1] = '\0';
		}
		fclose(f);
	}
}

void hardening() {
    prctl(PR_SET_DUMPABLE, 0);
    prctl(PR_SET_PTRACER, -1);

    int pid = getppid();
    char name[256] = {0};
    gets_process_name(pid, name);

    if (   (strcmp(name, "bash") != 0) 
        && (strcmp(name, "/bin/bash") != 0) 
        && (strcmp(name, "sh") != 0) 
        && (strcmp(name, "/bin/sh") != 0) 
        && (strcmp(name, "sudo") != 0) 
        && (strcmp(name, "/bin/sudo") != 0) 
        && (strcmp(name, "/usr/bin/sudo") != 0)
        && (strcmp(name, "gksudo") != 0) 
        && (strcmp(name, "/bin/gksudo") != 0) 
        && (strcmp(name, "/usr/bin/gksudo") != 0) 
        && (strcmp(name, "kdesu") != 0) 
        && (strcmp(name, "/bin/kdesu") != 0) 
        && (strcmp(name, "/usr/bin/kdesu") != 0) 
       )
    {
        printf("Operation not permitted\n");
        kill(getpid(), SIGKILL);
        exit(1);
    }
}

#endif /* HARDENING */

#if !TRACEABLE

#define _LINUX_SOURCE_COMPAT
#include <sys/ptrace.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <fcntl.h>
#include <signal.h>
#include <stdio.h>
#include <unistd.h>

#if !defined(PT_ATTACHEXC) /* New replacement for PT_ATTACH */
   #if !defined(PTRACE_ATTACH) && defined(PT_ATTACH)
       #define PT_ATTACHEXC	PT_ATTACH
   #elif defined(PTRACE_ATTACH)
       #define PT_ATTACHEXC PTRACE_ATTACH
   #endif
#endif

void untraceable(char * argv0)
{
	char proc[80];
	int pid, mine;

	switch(pid = fork()) {
	case  0:
		pid = getppid();
		/* For problematic SunOS ptrace */
#if defined(__FreeBSD__)
		sprintf(proc, "/proc/%d/mem", (int)pid);
#else
		sprintf(proc, "/proc/%d/as",  (int)pid);
#endif
		close(0);
		mine = !open(proc, O_RDWR|O_EXCL);
		if (!mine && errno != EBUSY)
			mine = !ptrace(PT_ATTACHEXC, pid, 0, 0);
		if (mine) {
			kill(pid, SIGCONT);
		} else {
			perror(argv0);
			kill(pid, SIGKILL);
		}
		_exit(mine);
	case -1:
		break;
	default:
		if (pid == waitpid(pid, 0, 0))
			return;
	}
	perror(argv0);
	_exit(1);
}
#endif /* !TRACEABLE */

char * xsh(int argc, char ** argv)
{
	char * scrpt;
	int ret, i, j;
	char ** varg;
	char * me = argv[0];
	if (me == NULL) { me = getenv("_"); }
	if (me == 0) { fprintf(stderr, "E: neither argv[0] nor $_ works."); exit(1); }

	ret = chkenv(argc);
	stte_0();
	 key(pswd, pswd_z);
	arc4(msg1, msg1_z);
	arc4(date, date_z);
	if (date[0] && (atoll(date)<time(NULL)))
		return msg1;
	arc4(shll, shll_z);
	arc4(inlo, inlo_z);
	arc4(xecc, xecc_z);
	arc4(lsto, lsto_z);
	arc4(tst1, tst1_z);
	 key(tst1, tst1_z);
	arc4(chk1, chk1_z);
	if ((chk1_z != tst1_z) || memcmp(tst1, chk1, tst1_z))
		return tst1;
	arc4(msg2, msg2_z);
	if (ret < 0)
		return msg2;
	varg = (char **)calloc(argc + 10, sizeof(char *));
	if (!varg)
		return 0;
	if (ret) {
		arc4(rlax, rlax_z);
		if (!rlax[0] && key_with_file(shll))
			return shll;
		arc4(opts, opts_z);
#if HARDENING
	    arc4_hardrun(text, text_z);
	    exit(0);
       /* Seccomp Sandboxing - Start */
       seccomp_hardening();
#endif
		arc4(text, text_z);
		arc4(tst2, tst2_z);
		 key(tst2, tst2_z);
		arc4(chk2, chk2_z);
		if ((chk2_z != tst2_z) || memcmp(tst2, chk2, tst2_z))
			return tst2;
		/* Prepend hide_z spaces to script text to hide it. */
		scrpt = malloc(hide_z + text_z);
		if (!scrpt)
			return 0;
		memset(scrpt, (int) ' ', hide_z);
		memcpy(&scrpt[hide_z], text, text_z);
	} else {			/* Reexecute */
		if (*xecc) {
			scrpt = malloc(512);
			if (!scrpt)
				return 0;
			sprintf(scrpt, xecc, me);
		} else {
			scrpt = me;
		}
	}
	j = 0;
#if BUSYBOXON
	varg[j++] = "busybox";
	varg[j++] = "sh";
#else
	varg[j++] = argv[0];		/* My own name at execution */
#endif
	if (ret && *opts)
		varg[j++] = opts;	/* Options on 1st line of code */
	if (*inlo)
		varg[j++] = inlo;	/* Option introducing inline code */
	varg[j++] = scrpt;		/* The script itself */
	if (*lsto)
		varg[j++] = lsto;	/* Option meaning last option */
	i = (ret > 1) ? ret : 0;	/* Args numbering correction */
	while (i < argc)
		varg[j++] = argv[i++];	/* Main run-time arguments */
	varg[j] = 0;			/* NULL terminated array */
#if DEBUGEXEC
	debugexec(shll, j, varg);
#endif
	execvp(shll, varg);
	return shll;
}

int main(int argc, char ** argv)
{
#if SETUID
   setuid(0);
#endif
#if DEBUGEXEC
	debugexec("main", argc, argv);
#endif
#if HARDENING
	hardening();
#endif
#if !TRACEABLE
	untraceable(argv[0]);
#endif
	argv[1] = xsh(argc, argv);
	fprintf(stderr, "%s%s%s: %s\n", argv[0],
		errno ? ": " : "",
		errno ? strerror(errno) : "",
		argv[1] ? argv[1] : "<null>"
	);
	return 1;
}
