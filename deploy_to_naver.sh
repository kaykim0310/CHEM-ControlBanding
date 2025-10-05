#!/bin/bash
echo "=== MSDS 분석기 네이버 클라우드 배포 스크립트 ==="
echo ""
echo "1. 웹서버 디렉토리로 이동"
cd /var/www/html

echo "2. 기존 파일 백업"
sudo mkdir -p /backup/$(date +%Y%m%d_%H%M%S)
sudo cp -r * /backup/$(date +%Y%m%d_%H%M%S)/ 2>/dev/null || true

echo "3. Apache 웹서버 설치 (이미 있으면 건너뜀)"
sudo apt update
sudo apt install -y apache2

echo "4. MSDS 분석기 파일들 다운로드"
sudo wget -O msds-app.tar.gz https://github.com/user/repo/releases/download/latest/msds-app.tar.gz

echo "5. 파일 압축 해제"
sudo tar -xzf msds-app.tar.gz
sudo mv dist/* ./

echo "6. 권한 설정"
sudo chown -R www-data:www-data /var/www/html
sudo chmod -R 755 /var/www/html

echo "7. 웹서버 재시작"
sudo systemctl restart apache2
sudo systemctl enable apache2

echo ""
echo "=== 배포 완료! ==="
echo "웹사이트 주소: http://211.188.63.17"
echo ""
