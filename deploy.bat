@echo off
echo ============================================
echo   画风参考库 一键部署到 GitHub Pages
echo   先改下面 REPO_URL 为你的仓库地址
echo ============================================
set REPO_URL=https://github.com/你的用户名/style-gallery.git
echo 目标仓库 - %REPO_URL%
echo.
git init
git add -A
git commit -m "feat - 画风参考库首次提交"
git branch -M main
git remote remove origin 2>nul
git remote add origin %REPO_URL%
git push -u origin main
echo.
echo 推送完成 去 GitHub 仓库 Settings - Pages 选 main 分支根目录
echo 稍等几分钟 访问 https://你的用户名.github.io/style-gallery/
pause
