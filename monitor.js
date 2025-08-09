#!/usr/bin/env node

import { spawn } from 'child_process';
import http from 'http';

class ServerMonitor {
    constructor() {
        this.serverProcess = null;
        this.isRestarting = false;
        this.restartCount = 0;
        this.maxRestarts = 10;
    }

    startServer() {
        console.log('🚀 サーバーを起動中...');
        
        this.serverProcess = spawn('node', ['--no-deprecation', 'server.js'], {
            stdio: 'inherit',
            cwd: process.cwd()
        });

        this.serverProcess.on('close', (code) => {
            console.log(`❌ サーバーが終了しました (コード: ${code})`);
            if (!this.isRestarting && this.restartCount < this.maxRestarts) {
                console.log('🔄 5秒後に自動再起動します...');
                setTimeout(() => {
                    this.restartCount++;
                    this.startServer();
                }, 5000);
            } else if (this.restartCount >= this.maxRestarts) {
                console.log('⚠️ 最大再起動回数に達しました。監視を停止します。');
                process.exit(1);
            }
        });

        this.serverProcess.on('error', (error) => {
            console.error('❌ サーバー起動エラー:', error);
        });

        // 2秒待ってから監視開始
        setTimeout(() => {
            this.startMonitoring();
        }, 2000);
    }

    startMonitoring() {
        console.log('👁️ サーバー監視を開始します (5秒間隔)');
        
        this.monitorInterval = setInterval(() => {
            this.checkServerHealth();
        }, 5000);
    }

    checkServerHealth() {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/health',
            method: 'GET',
            timeout: 3000
        };

        const req = http.request(options, (res) => {
            if (res.statusCode === 200) {
                console.log('✅ サーバー正常動作中');
                this.restartCount = 0; // リセット
            } else {
                console.log(`⚠️ サーバー異常レスポンス: ${res.statusCode}`);
                this.restartServer();
            }
        });

        req.on('error', (error) => {
            console.log('❌ サーバー接続失敗:', error.code);
            this.restartServer();
        });

        req.on('timeout', () => {
            console.log('❌ サーバー応答タイムアウト');
            req.destroy();
            this.restartServer();
        });

        req.end();
    }

    restartServer() {
        if (this.isRestarting) return;
        
        this.isRestarting = true;
        console.log('🔄 サーバーを再起動中...');
        
        if (this.serverProcess) {
            this.serverProcess.kill('SIGTERM');
        }
        
        clearInterval(this.monitorInterval);
        
        setTimeout(() => {
            this.isRestarting = false;
            this.restartCount++;
            if (this.restartCount <= this.maxRestarts) {
                this.startServer();
            } else {
                console.log('⚠️ 最大再起動回数に達しました。監視を停止します。');
                process.exit(1);
            }
        }, 2000);
    }

    stop() {
        console.log('🛑 監視を停止中...');
        clearInterval(this.monitorInterval);
        if (this.serverProcess) {
            this.serverProcess.kill('SIGTERM');
        }
        process.exit(0);
    }
}

const monitor = new ServerMonitor();

process.on('SIGINT', () => {
    monitor.stop();
});

process.on('SIGTERM', () => {
    monitor.stop();
});

monitor.startServer();