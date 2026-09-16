#!/bin/bash
# Provision the domain on first start, then run samba in the foreground.
set -euo pipefail
REALM="${REALM:-HARBORVIEW.LOCAL}"
DOMAIN="${DOMAIN:-HARBORVIEW}"
ADMINPASS="${ADMINPASS:-Harbor!Lab2026}"
MARK=/etc/samba/.provisioned

if [ ! -f "$MARK" ]; then
  echo "[lab] provisioning $REALM ($DOMAIN)"
  rm -f /etc/samba/smb.conf
  samba-tool domain provision \
    --use-rfc2307 \
    --realm="$REALM" --domain="$DOMAIN" \
    --server-role=dc --dns-backend=SAMBA_INTERNAL \
    --adminpass="$ADMINPASS" \
    --option="dns forwarder = 1.1.1.1" \
    --option="ldap server require strong auth = no" \
    --option="tls enabled = yes" \
    --option="log level = 1"
  cp /var/lib/samba/private/krb5.conf /etc/krb5.conf
  # Lab-only: simple passwords, never expire.
  samba-tool domain passwordsettings set --complexity=off --history-length=0 --min-pwd-length=6 --max-pwd-age=0 --min-pwd-age=0
  touch "$MARK"
  echo "[lab] provisioned"
fi

echo "[lab] starting samba (LDAP 389, LDAPS 636)"
exec samba --interactive --model=single
