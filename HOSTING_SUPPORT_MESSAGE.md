# Message for Hosting Support

---

**Subject:** Server Resource Exhaustion - Unable to SSH - Request for Assistance

**Body:**

Hello,

I'm experiencing a critical issue with my server and need immediate assistance.

**Problem:**
I'm unable to SSH into my server (IP: 192.250.229.108, Username: qozlgarl). When attempting to connect, I receive the error:
```
-bash: fork: retry: Resource temporarily unavailable
```

**Context:**
This issue occurred immediately after deploying a Node.js application. The application was creating multiple database connection instances, which appears to have exhausted system resources (process slots and/or file descriptors).

**What I've Done:**
I've identified and fixed the root cause in my application code - it was creating multiple PrismaClient instances (database connection pools) instead of using a single shared instance. The fix has been implemented in my codebase.

**What I Need:**
1. **Immediate Access:** Please help me regain SSH access to the server. This may require:
   - Killing stale processes for user `qozlgarl`
   - Checking and clearing any zombie processes
   - Restarting SSH service if necessary
   - Checking system resource limits (ulimit settings)

2. **System Check:** Please verify:
   - Current process count for user `qozlgarl`
   - File descriptor usage
   - System resource limits
   - Any runaway processes consuming resources

3. **PM2 Process Management:** Once access is restored, I need to:
   - Check PM2 status (`pm2 list`)
   - Restart my Node.js application with the fixed code
   - Verify the application is running correctly

**Application Details:**
- Node.js application running via PM2
- Application name: `queing-backend`
- Port: 5002
- Process manager: PM2

**Priority:**
This is urgent as my application is currently unavailable and I need to deploy the fix to resolve the resource exhaustion issue.

Thank you for your prompt assistance. Please let me know what information you need from me to proceed.

Best regards,
[Your Name]

---
