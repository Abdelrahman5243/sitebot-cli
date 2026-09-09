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
Set TypingSpeed 25ms

# Point `sitebot` at the local build so the demo needs no global install, and
# keep the prompt short so it does not distract.
Hide
Type "mkdir -p scripts/.demo-bin && ln -sf $PWD/dist/cli.js scripts/.demo-bin/sitebot" Enter
Type "export PATH=$PWD/scripts/.demo-bin:$PATH; export PS1='$ '; clear" Enter
Show

# 1. Just a URL: sitebot asks what to check, then how deep. Enter takes the
# highlighted default; the crawl size is dialled down to 25 so the demo stays
# short.
Sleep 400ms
Type "sitebot https://vercel.com"
Sleep 300ms
Enter

# "What should we check?" -> Full report
Sleep 1800ms
Enter

# "How many pages at most?" -> up twice from 100 to 25
Sleep 900ms
Up
Sleep 250ms
Up
Sleep 350ms
Enter

# "How hard should we hit the server?" -> Normal
Sleep 900ms
Enter

# "Also check links on other domains?" -> No
Sleep 900ms
Enter

Sleep 22s

Hide
Type "clear" Enter
Show
Sleep 400ms

# 2. Everything it can check.
Type "sitebot --help"
Sleep 400ms
Enter
Sleep 5s

Hide
Type "clear" Enter
Show
Sleep 400ms

# 3. Scripted use: flags skip the menu entirely, and the exit code makes it a
# CI gate.
Type "sitebot https://vercel.com --min-score 80 && echo 'gate passed'"
Sleep 300ms
Enter
Sleep 11s
