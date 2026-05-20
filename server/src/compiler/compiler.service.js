import { Types } from 'mongoose';

import jwt from 'jsonwebtoken';
import { User } from '../auth/user.schema.js';
import { Progress, AssessmentStage, ProgressStatus } from '../progress/progress.schema.js';
import { Submission } from '../problems/submission.schema.js';
import { Problem } from '../problems/problem.schema.js';
import { Exam } from '../exams/exam.schema.js';
import { Topic } from '../courses/topic.schema.js';
import { Course } from '../courses/course.schema.js';
import { PerformanceAnalysis } from '../interview/performance-analysis.schema.js';
import { spawn, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class CompilerService {
  TIMEOUT_MS = 2000;
  pythonCmd;

  constructor() {
    this.pythonCmd = this.getPythonCmd();
  }

  getPythonCmd() {
    const candidates = ['python3', 'python', 'python3.10', 'python3.11', 'python3.12'];
    for (const cmd of candidates) {
      try {
        execSync(`${cmd} --version`, { timeout: this.TIMEOUT_MS, stdio: 'pipe' });
        return cmd;
      } catch (e) {
        continue;
      }
    }
    return 'python3'; 
  }

  runProcess(cmd, args, input, timeout) {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let killed = false;

      const proc = spawn(cmd, args, { shell: true });
      const timer = setTimeout(() => {
        killed = true;
        try {
          proc.kill('SIGKILL');
        } catch (e) {}
        resolve({ stdout, stderr: stderr + '\n⏱ Time limit exceeded', code: 1 });
      }, timeout);

      if (input && input.trim()) {
        proc.stdin?.write(input);
      }
      proc.stdin?.end();

      proc.stdout?.on('data', (d) => { stdout += d.toString(); });
      proc.stderr?.on('data', (d) => { stderr += d.toString(); });

      proc.on('close', (code) => {
        if (!killed) {
          clearTimeout(timer);
          resolve({ stdout, stderr, code: code ?? 1 });
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        let friendly = err.message;
        if (err.code === 'ENOENT') {
          const cmdMap = {
            python3: `Python not found. Try installing Python 3 or ensure "${cmd}" is in your PATH.`,
            python: `Python not found. Install Python from https://python.org`,
            javac: `javac not found. Install JDK apt install default-jdk`,
            java: `java not found. Install JDK apt install default-jdk`,
            'g++': `g++ not found. Install apt install g++`,
            node: `node not found. Install: https://nodejs.org`,
          };
          friendly = cmdMap[cmd] || `Command "${cmd}" not found in PATH.`;
        }
        resolve({ stdout: '', stderr: friendly, code: 1 });
      });
    });
  }

  async executeCode(language, code, input = '') {
    const allowed = ['javascript', 'python', 'java', 'cpp', 'c', 'html', 'css', 'bash', 'yaml'];
    if (!allowed.includes(language)) {
      throw new Error(`Unsupported language`);
    }

    if (['html', 'css', 'yaml'].includes(language)) {
      return {
        success: true,
        output: 'valid', 
        error: '',
        exitCode: 0,
        execTime: 0,
      };
    }

    const tmpDir = os.tmpdir();
    const uid = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const startTime = Date.now();
    let result;

    try {
      if (language === 'javascript') {
        const file = path.join(tmpDir, `xl_${uid}.js`);
        fs.writeFileSync(file, code, 'utf8');
        result = await this.runProcess('node', [file], input, this.TIMEOUT_MS);
        try { fs.unlinkSync(file); } catch (e) {}
      } else if (language === 'python') {
        const file = path.join(tmpDir, `xl_${uid}.py`);
        fs.writeFileSync(file, code, 'utf8');
        result = await this.runProcess(this.pythonCmd, [file], input, this.TIMEOUT_MS);
        try { fs.unlinkSync(file); } catch (e) {}
      } else if (language === 'java') {
        const classDir = path.join(tmpDir, `xl_java_${uid}`);
        fs.mkdirSync(classDir, { recursive: true });

        let classMatch = code.match(/public\s+class\s+([A-Za-z0-9_$]+)/);
        if (!classMatch) {
          classMatch = code.match(/class\s+([A-Za-z0-9_$]+)/);
        }
        
        const className = classMatch ? classMatch[1] : 'Main';
        const srcFile = path.join(classDir, `${className}.java`);
        fs.writeFileSync(srcFile, code, 'utf8');

        const compile = await this.runProcess('javac', [srcFile], '', 15000);
        if (compile.code !== 0) {
          try { fs.rmSync(classDir, { recursive: true, force: true }); } catch (e) {}
          result = { stdout: '', stderr: compile.stderr || compile.stdout, code: 1 };
        } else {
          result = await this.runProcess('java', ['-cp', classDir, className], input, this.TIMEOUT_MS);
          try { fs.rmSync(classDir, { recursive: true, force: true }); } catch (e) {}
        }
      } else if (language === 'cpp') {
        const srcFile = path.join(tmpDir, `xl_${uid}.cpp`);
        const binFile = path.join(tmpDir, `xl_${uid}.out`);
        fs.writeFileSync(srcFile, code, 'utf8');

        const exeFile = os.platform() === 'win32' ? `${binFile}.exe` : binFile;

        const compile = await this.runProcess('g++', ['-o', exeFile, srcFile, '-std=c++17'], '', 15000);
        if (compile.code !== 0) {
          try { fs.unlinkSync(srcFile); } catch (e) {}
          result = { stdout: '', stderr: compile.stderr, code: 1 };
        } else {
          result = await this.runProcess(exeFile, [], input, this.TIMEOUT_MS);
          try { fs.unlinkSync(srcFile); } catch (e) {}
          try { fs.unlinkSync(exeFile); } catch (e) {}
        }
      } else if (language === 'c') {
        const srcFile = path.join(tmpDir, `xl_${uid}.c`);
        const binFile = path.join(tmpDir, `xl_${uid}.out`);
        fs.writeFileSync(srcFile, code, 'utf8');

        const exeFile = os.platform() === 'win32' ? `${binFile}.exe` : binFile;

        const compile = await this.runProcess('gcc', ['-o', exeFile, srcFile], '', 15000);
        if (compile.code !== 0) {
          try { fs.unlinkSync(srcFile); } catch (e) {}
          result = { stdout: '', stderr: compile.stderr, code: 1 };
        } else {
          result = await this.runProcess(exeFile, [], input, this.TIMEOUT_MS);
          try { fs.unlinkSync(srcFile); } catch (e) {}
          try { fs.unlinkSync(exeFile); } catch (e) {}
        }
      } else if (language === 'bash') {
        const file = path.join(tmpDir, `xl_${uid}.sh`);
        fs.writeFileSync(file, code, 'utf8');
        result = await this.runProcess('bash', [file], input, this.TIMEOUT_MS);
        try { fs.unlinkSync(file); } catch (e) {}
      } else {
        result = { stdout: '', stderr: `Language ${language} implementation missing`, code: 1 };
      }
    } catch (error) {
      throw new Error(error.message);
    }

    const execTime = Date.now() - startTime;

    return {
      success: result.code === 0,
      output: result.stdout || '',
      error: result.stderr || '',
      exitCode: result.code,
      execTime,
    };
  }
}
