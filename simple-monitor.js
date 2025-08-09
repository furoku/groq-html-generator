#!/usr/bin/env node

import { spawn } from 'child_process';
import http from 'http';

let serverProcess = null;
let isRestarting = false;
let restartCount = 0;
const maxRestarts = 10;

function startServer() {
    console.log('🚀 サーバーを起動中...');
    
    serverProcess = spawn('node', ['--no-deprecation', 'server.js'], {
        stdio: ['inherit', 'pipe', 'pipe'],
        cwd: process.cwd()
    });

    // サーバーの出力を表示
    serverProcess.stdout.on('data', (data) => {
        process.stdout.write(data);
    });

    serverProcess.stderr.on('data', (data) => {
        process.stderr.write(data);
    });

    serverProcess.on('close', (code) => {
        console.log(`\n❌ サーバーが終了しました (コード: ${code})`);
        if (!isRestarting && restartCount < maxRestarts) {
            console.log('🔄 3秒後に自動再起動します...');
            setTimeout(() => {
                restartCount++;
                startServer();
            }, 3000);
        } else if (restartCount >= maxRestarts) {
            console.log('⚠️ 最大再起動回数に達しました。監視を停止します。');
            process.exit(1);
        }
    });

    serverProcess.on('error', (error) => {
        console.error('❌ サーバー起動エラー:', error);
    });

    // 5秒待ってから監視開始
    setTimeout(() => {
        startMonitoring();
    }, 5000);
}

function startMonitoring() {
    console.log('👁️ サーバー監視を開始します (30秒間隔)');
    
    setInterval(() => {
        if (isRestarting) return; // 再起動中は監視スキップ
        
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: '/health',
            method: 'GET',
            timeout: 5000
        }, (res) => {
            if (res.statusCode === 200) {
                console.log('✅ サーバー正常動作中');
                restartCount = 0; // 成功時はリセット
            } else {
                console.log(`⚠️ サーバー異常レスポンス: ${res.statusCode}`);
                // 5xx系エラーの場合のみ再起動
                if (res.statusCode >= 500) {
                    restartServer();
                }
            }
        });

        req.on('error', (error) => {
            console.log('❌ サーバー接続失敗:', error.code);
            // ECONNREFUSED の場合のみ再起動
            if (error.code === 'ECONNREFUSED') {
                restartServer();
            }
        });

        req.on('timeout', () => {
            console.log('⚠️ サーバー応答タイムアウト (AI処理中の可能性があります)');
            req.destroy();
            // タイムアウトでは再起動しない（AI処理中の可能性が高い）
        });

        req.end();
    }, 30000); // 30秒間隔に変更
}

function restartServer() {
    if (isRestarting) return;
    
    isRestarting = true;
    console.log('🔄 サーバーを強制終了中...');
    
    if (serverProcess && !serverProcess.killed) {
        serverProcess.kill('SIGKILL'); // より強力な終了
    }
    
    setTimeout(() => {
        isRestarting = false;
        restartCount++;
        if (restartCount <= maxRestarts) {
            startServer();
        } else {
            console.log('⚠️ 最大再起動回数に達しました。監視を停止します。');
            process.exit(1);
        }
    }, 2000);
}

function stopMonitor() {
    console.log('🛑 監視を停止中...');
    if (serverProcess && !serverProcess.killed) {
        serverProcess.kill('SIGKILL');
    }
    process.exit(0);
}

process.on('SIGINT', stopMonitor);
process.on('SIGTERM', stopMonitor);

startServer();