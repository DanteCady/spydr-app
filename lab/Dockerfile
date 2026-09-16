# Samba Active Directory domain controller for local Spydr testing. arm64 and amd64.
FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      samba samba-ad-dc samba-ad-provision samba-dsdb-modules samba-vfs-modules python3-samba \
      ldap-utils smbclient ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY entrypoint.sh seed.sh /lab/
RUN chmod +x /lab/entrypoint.sh /lab/seed.sh
EXPOSE 389 636
ENTRYPOINT ["/lab/entrypoint.sh"]
