# VHS script for the README demo.
#
#   npm run build && vhs scripts/demo.tape
#
# Regenerate whenever the CLI output changes. Needs vhs, ttyd, and ffmpeg.

Output demo.gif

Set Shell bash
Set FontSize 14
Set Width 1100
Set Height 800
Set Padding 16
Set Theme "Catppuccin Mocha"
Set TypingSpeed 40ms

# Point `sitebot` at the local build so the demo needs no global install, and
# keep the prompt short so it does not distract.
Hide
Type "mkdir -p scripts/.demo-bin && ln -sf $PWD/dist/cli.js scripts/.demo-bin/sitebot" Enter
Type "export PATH=$PWD/scripts/.demo-bin:$PATH; export PS1='$ '; clear" Enter
Show

# 1. One URL, one report. `--fail-on never` keeps a warning from ending the
# demo on a red exit code.
Sleep 800ms
Type "sitebot https://vercel.com --fail-on never"
Sleep 500ms
Enter
Sleep 12s

Hide
Type "clear" Enter
Show
Sleep 400ms

# 2. Everything it can check.
Type "sitebot --help"
Sleep 400ms
Enter
Sleep 8s

Hide
Type "clear" Enter
Show
Sleep 400ms

# 3. The payoff: crawl the site and check every link in one pass.
Type "sitebot https://vercel.com --crawl --limit 12 --links --fail-on never"
Sleep 500ms
Enter
Sleep 28s
