#if 0
	shc Version 4.0.3, Generic Shell Script Compiler
	GNU GPL Version 3 Md Jahidul Hamid <jahidulhamid@yahoo.com>

	shc -f remote_exec.sh -o remote_exec.bin 
#endif

static  char data [] = 
#define      tst2_z	19
#define      tst2	((&data[2]))
	"\336\207\321\211\133\213\332\050\060\114\012\267\236\033\136\005"
	"\330\247\167\210\100\312\236\010"
#define      msg2_z	19
#define      msg2	((&data[28]))
	"\300\204\067\354\230\124\065\035\172\022\134\230\307\167\244\342"
	"\210\324\071\203\310\341\376\130\355\200\001"
#define      rlax_z	1
#define      rlax	((&data[51]))
	"\112"
#define      date_z	1
#define      date	((&data[52]))
	"\133"
#define      opts_z	1
#define      opts	((&data[53]))
	"\131"
#define      msg1_z	65
#define      msg1	((&data[64]))
	"\002\047\275\340\256\207\177\266\044\127\163\062\257\204\014\302"
	"\372\060\345\074\021\373\337\056\255\366\010\163\120\374\355\357"
	"\242\231\300\053\054\353\200\302\141\362\343\077\163\210\213\241"
	"\237\303\040\377\353\330\301\145\232\247\063\117\123\124\343\002"
	"\042\145\263\271\071\214\356\273\337\150\003\223\345\334\313\321"
	"\065\270\121\066\130\072\151\200\352\117\037"
#define      lsto_z	1
#define      lsto	((&data[145]))
	"\113"
#define      pswd_z	256
#define      pswd	((&data[196]))
	"\061\205\041\340\015\241\227\062\371\052\027\325\366\351\013\257"
	"\072\101\007\165\252\210\140\372\247\320\317\345\333\227\046\015"
	"\035\107\355\052\351\204\134\342\257\163\270\245\135\303\125\227"
	"\005\134\143\235\040\151\364\261\140\301\274\231\147\060\364\342"
	"\023\331\171\263\071\261\032\174\351\335\344\052\267\124\322\315"
	"\364\065\152\025\237\137\307\377\040\203\230\210\264\214\153\307"
	"\146\344\172\240\226\225\035\177\162\001\252\052\125\174\370\112"
	"\262\143\137\121\302\046\120\343\252\351\153\136\165\326\045\334"
	"\272\240\174\121\065\232\320\250\233\173\323\361\367\313\074\252"
	"\056\234\373\361\303\114\324\155\065\077\313\253\025\360\210\320"
	"\220\005\041\306\237\362\156\073\155\102\054\144\015\151\017\074"
	"\005\013\055\310\127\001\066\215\101\001\071\127\362\301\047\202"
	"\306\110\111\145\072\267\241\250\371\316\015\007\067\034\104\075"
	"\047\161\006\176\163\074\014\265\075\105\014\057\006\063\262\314"
	"\174\373\062\267\263\324\137\255\242\154\264\331\211\371\026\260"
	"\152\035\057\336\131\073\223\226\200\237\306\206\323\170\123\120"
	"\163\206\010\047\132\150\324\374\325\211\326\136\202\355\016\354"
	"\012\076\313\143\171\137\372\371\377\300\200\322\071\324\043\254"
	"\133\053\324\265\223\250\262\150\061\210\307\263\166\325\240\200"
	"\023\153\015\257\345\155\252\214\076\171\162\031\021\230\047\056"
	"\340\025"
#define      xecc_z	15
#define      xecc	((&data[471]))
	"\265\254\111\142\230\007\220\264\237\061\317\065\016\043\024\346"
	"\075\347\051\144"
#define      chk2_z	19
#define      chk2	((&data[490]))
	"\104\036\111\144\350\232\346\145\230\312\350\072\173\224\040\354"
	"\115\064\223\122\005"
#define      shll_z	10
#define      shll	((&data[510]))
	"\335\213\266\114\201\232\232\174\073\116\352"
#define      tst1_z	22
#define      tst1	((&data[523]))
	"\023\330\001\175\002\346\032\201\066\134\345\215\300\152\362\366"
	"\327\325\304\357\304\225\360\266\316\205\362\022"
#define      inlo_z	3
#define      inlo	((&data[548]))
	"\006\045\102"
#define      chk1_z	22
#define      chk1	((&data[552]))
	"\311\236\106\224\315\147\230\202\037\275\367\152\272\063\377\307"
	"\255\312\110\341\245\141\330\310\120\166"
#define      text_z	1230
#define      text	((&data[723]))
	"\001\000\003\106\037\060\347\113\015\156\344\225\201\274\226\007"
	"\256\250\046\310\352\045\366\204\357\277\324\145\321\116\100\322"
	"\116\104\031\155\164\001\270\202\157\235\030\361\132\256\371\010"
	"\127\037\321\101\104\307\305\063\207\232\231\130\350\331\053\067"
	"\035\104\245\222\105\135\025\265\373\055\246\125\333\237\136\062"
	"\276\057\164\003\367\071\067\176\324\320\326\274\252\001\364\310"
	"\106\231\133\213\367\161\100\362\236\347\107\172\206\245\255\105"
	"\325\041\111\314\133\200\113\057\121\042\354\374\044\340\304\152"
	"\171\040\366\160\221\066\142\060\036\252\252\245\120\130\352\045"
	"\171\063\235\373\213\065\226\337\321\035\040\161\322\242\262\075"
	"\233\233\334\050\110\177\223\160\031\325\056\347\240\370\366\203"
	"\366\306\131\237\112\221\350\251\334\315\144\232\055\353\010\050"
	"\072\214\143\035\311\105\362\215\274\304\244\056\112\002\117\244"
	"\310\002\120\115\370\111\135\375\005\124\365\162\113\363\124\230"
	"\167\266\334\372\144\031\250\216\165\272\366\302\167\254\350\067"
	"\277\227\312\336\373\247\350\165\210\062\107\075\176\044\133\136"
	"\126\117\365\371\334\374\331\055\265\175\154\005\300\015\214\127"
	"\273\203\247\177\107\316\074\364\214\111\134\200\042\250\344\103"
	"\340\333\013\237\167\216\265\062\344\013\203\370\324\163\270\356"
	"\004\237\224\023\141\306\030\356\251\264\013\160\347\240\356\335"
	"\256\256\256\012\141\123\205\166\237\203\214\056\147\343\154\365"
	"\035\156\150\263\176\020\140\017\357\350\202\332\222\273\312\216"
	"\245\163\013\101\351\116\274\274\342\015\137\015\072\010\102\211"
	"\353\126\255\274\153\317\322\365\306\353\315\006\374\154\315\105"
	"\157\111\351\332\373\310\110\037\313\136\342\255\102\014\102\227"
	"\021\063\264\042\005\371\135\252\200\365\136\125\020\317\141\326"
	"\357\113\366\275\114\310\326\161\373\305\365\354\250\124\321\244"
	"\031\216\133\211\164\306\042\114\173\314\022\273\273\175\075\306"
	"\350\061\300\277\363\341\005\117\125\314\267\200\067\314\165\135"
	"\146\243\277\243\224\315\155\125\262\144\030\153\115\354\261\326"
	"\147\221\142\361\027\134\002\240\011\050\272\162\001\002\100\244"
	"\172\321\352\353\171\166\172\122\327\174\032\176\346\001\204\015"
	"\010\364\211\361\213\123\334\220\214\323\170\161\204\200\110\276"
	"\003\315\133\127\122\006\167\053\364\006\071\312\170\003\347\124"
	"\004\121\226\030\136\140\212\163\210\331\156\041\010\234\134\360"
	"\203\350\235\265\133\262\030\314\245\330\354\315\216\203\156\000"
	"\127\357\062\007\154\300\331\121\254\157\112\274\060\324\330\014"
	"\364\204\342\002\022\002\022\162\033\140\016\207\011\066\033\026"
	"\356\355\065\044\361\352\210\113\027\356\210\360\205\157\371\333"
	"\332\045\101\123\166\014\272\123\203\147\332\254\011\350\115\324"
	"\166\060\034\067\341\075\320\120\142\205\110\036\043\371\134\051"
	"\127\362\301\334\175\276\004\203\360\263\006\035\162\163\135\264"
	"\141\102\320\100\371\252\340\330\077\116\034\157\173\353\006\151"
	"\206\041\334\062\371\067\227\154\047\376\101\262\173\267\156\373"
	"\307\135\250\102\067\332\076\232\301\100\353\043\303\051\357\236"
	"\334\301\014\200\256\040\377\022\230\147\164\163\241\150\371\236"
	"\116\137\261\326\272\262\130\261\345\145\360\155\150\072\022\061"
	"\273\364\076\035\355\256\060\130\336\015\123\242\077\331\123\125"
	"\060\005\100\313\112\013\037\304\152\017\324\367\246\072\335\065"
	"\052\016\102\275\073\262\150\254\366\203\276\215\325\152\334\107"
	"\014\316\012\133\366\057\020\132\321\055\214\204\371\250\144\357"
	"\011\051\237\077\215\140\123\217\162\272\115\313\032\176\302\055"
	"\177\364\276\312\103\367\306\150\240\253\266\267\116\027\224\117"
	"\373\243\166\363\127\243\324\063\040\174\360\052\130\051\160\005"
	"\063\033\022\221\027\344\301\140\333\250\127\005\130\071\346\354"
	"\201\073\176\151\114\030\210\354\206\305\121\317\375\052\116\030"
	"\116\232\050\313\075\125\145\302\066\211\202\242\001\010\234\237"
	"\201\341\036\103\071\357\010\267\264\017\105\061\212\130\171\360"
	"\244\042\265\143\170\176\272\162\056\375\106\324\302\126\254\021"
	"\320\034\113\231\163\266\153\310\246\377\266\164\366\067\003\342"
	"\331\223\204\324\107\226\320\122\026\160\301\141\144\033\223\101"
	"\135\030\355\315\112\160\372\252\125\174\123\164\020\303\100\116"
	"\202\357\172\154\261\254\063\066\353\270\215\377\156\223\340\125"
	"\123\321\373\164\167\003\337\016\100\271\366\174\043\341\332\345"
	"\116\041\352\366\170\357\131\161\272\236\045\227\200\002\127\164"
	"\025\250\223\150\345\037\007\317\202\231\115\177\002\376\002\122"
	"\052\330\060\101\213\163\007\214\361\113\001\375\233\250\151\274"
	"\036\005\134\047\120\056\315\046\337\021\253\207\224\024\323\011"
	"\300\067\362\303\166\372\110\204\305\142\252\202\116\122\217\151"
	"\243\377\122\212\014\267\205\230\204\247\054\100\031\255\142\302"
	"\067\340\376\333\044\074\337\345\364\324\174\137\123\023\362\154"
	"\005\223\312\126\366\107\045\173\173\022\300\032\316\336\022\374"
	"\063\227\042\063\021\355\327\177\217\260\314\136\251\303\047\263"
	"\161\274\122\313\120\303\210\001\324\221\141\203\036\075\026\262"
	"\044\336\271\003\015\276\265\207\336\013\336\101\346\322\237\225"
	"\331\366\373\275\072\360\243\172\245\265\311\362\106\010\315\256"
	"\274\341\143\345\040\242\140\347\037\112\005\310\324\143\075\152"
	"\044\264\231\272\166\042\120\336\325\006\343\144\226\330\323\117"
	"\132\263\133\276\335\000\124\002\216\205\225\063\262\042\036\060"
	"\217\224\032\231\306\354\066\040\063\354\207\076\264\034\172\241"
	"\217\023\357\137\070\123\257\352\142\127\227\252\121\123\231\020"
	"\002\201\033\001\244\332\101\266\264\171\140\156\161\205\227\211"
	"\267\211\243\153\333\365\303\157\164\147\006\054\336\250\265\307"
	"\223\025\055\026\366\363\214\051\074\116\066\017\245\163\060\153"
	"\323\220\221\364\242\264\002\075\211\060\075\154\157\100\245\155"
	"\347\142\046\134\034\001\021\270\061\320\226\020\265\244\060\131"
	"\362\325\264\076\004\005\140\360\001\204\320\306\356\112\346\344"
	"\272\170\033\035\250\071\307\123\337\030\253\311\075\045\375\060"
	"\372\262\156\377\267\317\360\271\123\301\200\102\013\147\047\306"
	"\337\102\343\210\174\253\333\133\303\207\045\001\254\043\062\247"
	"\325\241\247\215\160\227\107\304\130\310\006\144\057\055\052\017"
	"\160\016\227\355\271\163\111\175\372\157\176\247\222\261\117\150"
	"\122\366\365\302\216\075\206\346\005\215\113\064\272\165\104\052"
	"\203\333\030\075\116\141\272\110\320\071\360\142\352\077\313\074"
	"\065\300\377\303\376\206\252\003\023\365\070\315\153\174\370\357"
	"\130\020\054\247\162\347\360\102\040\340\245\013\037\160\110\125"
	"\061\110\030\057\316\303\063\341\271\154\257\044\351\250\024\101"
	"\271\100\350\053\050\331\156\111\271\023\124\331\204\235\056\265"
	"\345\106\345\263\012\030\225\303\204\105\350\155\355\374\257\246"
	"\075\230\322\145\161\100\256\053\124\003\004\330\240\062\215\206"
	"\171\162\072\203\213\317\106\020\024\056\176\002\053\055\251\150"
	"\306\173\316\070\274\175\143\020\201\150\350\042\232\166\250\024"
	"\351\342\227\165\262\336\205"/* End of data[] */;
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
