#!/usr/bin/env bash
# Lets only Cloudflare reach the web ports (80 and 443), so nobody can skip Cloudflare's protection by going straight to
# the server's address. Run as root; re-run now and then (Cloudflare changes its ranges rarely):
#
#   sudo ./cloudflare-firewall.sh            apply
#   ./cloudflare-firewall.sh --print         show what would be applied, change nothing
#
# Why iptables and not ufw: Docker publishes ports by writing its own iptables rules, which ufw rules do not cover.
# The DOCKER-USER chain is checked before Docker's rules, so that is where the filter goes.
# Keep SSH (port 22) closed to the world: allow it only from your own address with ufw, or use a VPN or Cloudflare Tunnel.
# After applying, make it survive a reboot:  sudo apt install iptables-persistent && sudo netfilter-persistent save
set -euo pipefail

mode="${1:-apply}"
v4="$(curl -fsS https://www.cloudflare.com/ips-v4)"
v6="$(curl -fsS https://www.cloudflare.com/ips-v6)"
[ -n "$v4" ] && [ -n "$v6" ] || { echo "could not fetch Cloudflare's address list"; exit 1; }

if [ "$mode" = "--print" ]; then
  echo "allow tcp 80,443 from:"; echo "$v4"; echo "$v6"
  exit 0
fi
[ "$(id -u)" = 0 ] || { echo "run as root"; exit 1; }

apply() {
  local tool="$1" ranges="$2" chain=SOUSCHEF_CF
  "$tool" -N "$chain" 2>/dev/null || "$tool" -F "$chain"
  for range in $ranges; do "$tool" -A "$chain" -s "$range" -j RETURN; done
  "$tool" -A "$chain" -j DROP
  "$tool" -C DOCKER-USER -p tcp -m multiport --dports 80,443 -j "$chain" 2>/dev/null \
    || "$tool" -I DOCKER-USER -p tcp -m multiport --dports 80,443 -j "$chain"
}
apply iptables "$v4"
apply ip6tables "$v6"
echo "done: ports 80 and 443 now accept only Cloudflare"
