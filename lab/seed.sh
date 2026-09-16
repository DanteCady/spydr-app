#!/bin/bash
# Seed "Harborview Logistics": a plausible mid-size company directory with the kinds of
# accumulated mess real domains have. Idempotent: re-running skips what already exists.
set -u
REALM="${REALM:-HARBORVIEW.LOCAL}"
PW="${SEEDPASS:-Harbor!Lab2026}"
MAIL_DOMAIN="harborview.com"
BASE="DC=$(echo "$REALM" | tr 'A-Z' 'a-z' | sed 's/\./,DC=/g')"
st()  { samba-tool "$@" >/dev/null 2>&1 || true; }
ou()  { if [ -n "${2:-}" ]; then st ou create "$1,$BASE" --description="$2"; else st ou create "$1,$BASE"; fi; }
grp() { # LDAP rejects empty attribute values, so only pass a description when there is one.
  if [ -n "${5:-}" ]; then st group add "$1" --group-scope="${2:-Global}" --group-type="${3:-Security}" --groupou="$4" --description="$5"
  else st group add "$1" --group-scope="${2:-Global}" --group-type="${3:-Security}" --groupou="$4"; fi
}
usr() { # sam given surname ou title department
  st user create "$1" "$PW" --given-name="$2" --surname="$3" --mail-address="$1@$MAIL_DOMAIN" --userou="$4" --job-title="$5" --department="$6" --company="Harborview Logistics"
  st user setexpiry "$1" --noexpiry
}
svc() { st user create "$1" "$PW" --userou="OU=Service Accounts,OU=Harborview" --description="$2"; st user setexpiry "$1" --noexpiry; }
mem() { # one member per call (samba-tool aborts the batch if any member already exists); split on commas only
  local IFS=','; local m; for m in $2; do st group addmembers "$1" "$m"; done
}

echo "[seed] OU structure"
ou "OU=Harborview" "Company root"
for o in "OU=Users,OU=Harborview" "OU=Groups,OU=Harborview" "OU=Service Accounts,OU=Harborview" \
         "OU=Workstations,OU=Harborview" "OU=Servers,OU=Harborview" "OU=Disabled Users,OU=Harborview" \
         "OU=Contractors,OU=Harborview"; do ou "$o" ""; done
for d in Finance Engineering Sales "Human Resources" IT Operations Warehouse; do ou "OU=$d,OU=Users,OU=Harborview" "$d department"; done
for g in "Role Groups" "Resource Groups" "Distribution Lists" "Legacy"; do ou "OU=$g,OU=Groups,OU=Harborview" ""; done
ou "OU=Chicago,OU=Workstations,OU=Harborview" "Chicago HQ desktops"
ou "OU=Rotterdam,OU=Workstations,OU=Harborview" "Rotterdam office"

RG="OU=Role Groups,OU=Groups,OU=Harborview"; RS="OU=Resource Groups,OU=Groups,OU=Harborview"
DL="OU=Distribution Lists,OU=Groups,OU=Harborview"; LG="OU=Legacy,OU=Groups,OU=Harborview"

echo "[seed] role groups (inconsistent naming is intentional)"
grp "SG-IT-Tier0"          Global Security "$RG" "Tier 0 administrators"
grp "SG-IT-ServerAdmins"   Global Security "$RG" "Server administrators"
grp "SG-IT-Helpdesk"       Global Security "$RG" "Service desk analysts"
grp "SG-IT-Tier1"          Global Security "$RG" "Tier 1 support"
grp "GG_Finance_Users"     Global Security "$RG" "Finance department"
grp "GG_Finance_Managers"  Global Security "$RG" "Finance leadership"
grp "GG_Eng_Developers"    Global Security "$RG" "Software engineers"
grp "GG_Eng_Leads"         Global Security "$RG" "Engineering leads"
grp "GG_Sales_Team"        Global Security "$RG" "Sales"
grp "GG_HR_Staff"          Global Security "$RG" "HR"
grp "GG_Ops_Dispatch"      Global Security "$RG" "Dispatch and operations"
grp "GG_Warehouse_Staff"   Global Security "$RG" "Warehouse floor"
grp "Contractors-All"      Global Security "$RG" "All external contractors"
grp "VPN Users"            Global Security "$RG" "Remote access"

echo "[seed] resource groups (domain local, ACL-style)"
grp "DL-FS-Finance-RW"     Domain Security "$RS" "Finance share read/write"
grp "DL-FS-Finance-RO"     Domain Security "$RS" "Finance share read"
grp "DL-FS-Engineering-RW" Domain Security "$RS" "Engineering share"
grp "DL-FS-HR-Confidential" Domain Security "$RS" "HR confidential share"
grp "DL-App-ERP-Users"     Domain Security "$RS" "ERP application access"
grp "DL-App-ERP-Admins"    Domain Security "$RS" "ERP administrators"
grp "DL-App-WMS-Users"     Domain Security "$RS" "Warehouse management system"
grp "DL-SQL-Prod-Readers"  Domain Security "$RS" "Production SQL read"
grp "DL-Print-Chicago"     Domain Security "$RS" ""
grp "DL-Print-Rotterdam"   Domain Security "$RS" ""
grp "DL-RDP-JumpHost"      Domain Security "$RS" "RDP to jump host"

echo "[seed] distribution lists"
grp "All Employees"        Universal Distribution "$DL" "Company-wide announcements"
grp "Finance Team"         Universal Distribution "$DL" ""
grp "Engineering"          Universal Distribution "$DL" ""
grp "Chicago Office"       Universal Distribution "$DL" ""

echo "[seed] legacy leftovers from the 2019 migration"
grp "Old_Exchange_Users"   Global Security "$LG" "Exchange 2013 users (decommissioned)"
grp "Citrix_Users_2016"    Global Security "$LG" "Citrix farm (decommissioned)"
grp "Citrix_Admins_2016"   Global Security "$LG" ""
grp "Acme_Migration_Temp"  Global Security "$LG" "Temporary group for the Acme acquisition"
grp "FS01_Share_Users"     Global Security "$LG" "Old file server"
grp "FS01_Share_Admins"    Global Security "$LG" ""
grp "Backup Operators Legacy" Global Security "$LG" ""
grp "Project Meridian"     Global Security "$LG" "Project closed 2021"
# Abandoned groups nobody ever populated or emptied out — the real empty-group problem,
# as opposed to the built-in groups AD ships empty on purpose.
grp "SG-Project-Atlas"     Global Security "$LG" "Project Atlas — cancelled before kickoff"
grp "DL-FS-Archive-RO"     Domain Security "$LG" "Archive share, decommissioned 2022"
grp "GG_Temp_Auditors"     Global Security "$LG" "External audit 2023"

echo "[seed] people"
U="OU=Users,OU=Harborview"
usr "mrodriguez"  Maria     Rodriguez "OU=IT,$U"              "Director of IT"            IT
usr "jchen"       Jason     Chen      "OU=IT,$U"              "Systems Administrator"     IT
usr "dpatel"      Deepa     Patel     "OU=IT,$U"              "Service Desk Lead"         IT
usr "tnguyen"     Tuan      Nguyen    "OU=IT,$U"              "Service Desk Analyst"      IT
usr "kowens"      Kyle      Owens     "OU=IT,$U"              "Service Desk Analyst"      IT
usr "sbrennan"    Siobhan   Brennan   "OU=Finance,$U"         "CFO"                       Finance
usr "rgoldberg"   Ruth      Goldberg  "OU=Finance,$U"         "Controller"                Finance
usr "aokafor"     Adaeze    Okafor    "OU=Finance,$U"         "Senior Accountant"         Finance
usr "mfischer"    Markus    Fischer   "OU=Finance,$U"         "Accounts Payable"          Finance
usr "lsantos"     Lucia     Santos    "OU=Engineering,$U"     "VP Engineering"            Engineering
usr "pkumar"      Priya     Kumar     "OU=Engineering,$U"     "Engineering Lead"          Engineering
usr "bwilliams"   Ben       Williams  "OU=Engineering,$U"     "Software Engineer"         Engineering
usr "hyamamoto"   Hana      Yamamoto  "OU=Engineering,$U"     "Software Engineer"         Engineering
usr "ojensen"     Oskar     Jensen    "OU=Engineering,$U"     "Software Engineer"         Engineering
usr "cmoreau"     Camille   Moreau    "OU=Engineering,$U"     "QA Engineer"               Engineering
usr "gthompson"   Grant     Thompson  "OU=Sales,$U"           "VP Sales"                  Sales
usr "nali"        Nadia     Ali       "OU=Sales,$U"           "Account Executive"         Sales
usr "rvanderberg" Ruben     Vanderberg "OU=Sales,$U"          "Account Executive"         Sales
usr "eharris"     Evelyn    Harris    "OU=Human Resources,$U" "HR Director"               "Human Resources"
usr "jkim"        Joon      Kim       "OU=Human Resources,$U" "HR Generalist"             "Human Resources"
usr "fdiallo"     Fatou     Diallo    "OU=Operations,$U"      "Operations Manager"        Operations
usr "wbecker"     Wolfgang  Becker    "OU=Operations,$U"      "Dispatcher"                Operations
usr "lmartin"     Louis     Martin    "OU=Operations,$U"      "Dispatcher"                Operations
usr "arossi"      Alessia   Rossi     "OU=Warehouse,$U"       "Warehouse Supervisor"      Warehouse
usr "dbrown"      Darnell   Brown     "OU=Warehouse,$U"       "Forklift Operator"         Warehouse
usr "ikowalski"   Igor      Kowalski  "OU=Warehouse,$U"       "Forklift Operator"         Warehouse
# ex-employees and contractors
usr "pmiller"     Paul      Miller    "OU=Disabled Users,OU=Harborview" "Systems Administrator (left 2024)" IT
usr "sgreen"      Sarah     Green     "OU=Disabled Users,OU=Harborview" "Accountant (left 2023)" Finance
usr "vkapoor"     Vikram    Kapoor    "OU=Contractors,OU=Harborview"    "ERP Consultant (Acme)"  Contractor
usr "ext.jbauer"  Jonas     Bauer     "OU=Contractors,OU=Harborview"    "Network Contractor"     Contractor
usr "ext.mliu"    Mei       Liu       "OU=Contractors,OU=Harborview"    "Migration Contractor (2019)" Contractor

echo "[seed] service accounts"
svc "svc-backup"   "Veeam backup service"
svc "svc-sql-prod" "SQL Server production service"
svc "svc-erp"      "ERP application pool"
svc "svc-scanner"  "MFP scan-to-share"
svc "svc-citrix"   "Citrix 2016 service (decommissioned)"
svc "svc-monitor"  "PRTG monitoring"

echo "[seed] computers"
for c in HQ-DC02 HQ-FS02 HQ-SQL01 HQ-ERP01 HQ-JUMP01 RTD-FS01 HQ-VEEAM01; do st computer create "$c" --computerou="OU=Servers,OU=Harborview"; done
for c in CHI-LT-MRODRIG CHI-LT-JCHEN CHI-WS-FIN01 CHI-WS-FIN02 CHI-LT-PKUMAR CHI-LT-BWILL; do st computer create "$c" --computerou="OU=Chicago,OU=Workstations,OU=Harborview"; done
for c in RTD-WS-OPS01 RTD-WS-OPS02 RTD-LT-FDIALLO; do st computer create "$c" --computerou="OU=Rotterdam,OU=Workstations,OU=Harborview"; done

echo "[seed] IT tiering — the escalation nobody meant to create"
mem "Domain Admins" "SG-IT-Tier0"
mem "SG-IT-Tier0" "mrodriguez,SG-IT-ServerAdmins"          # ServerAdmins nested into Tier0
mem "SG-IT-ServerAdmins" "jchen,SG-IT-Helpdesk"             # Helpdesk nested into ServerAdmins "so they can reboot servers"
mem "SG-IT-Helpdesk" "dpatel,tnguyen,kowens,SG-IT-Tier1"
mem "SG-IT-Tier1" "kowens,ext.jbauer"                      # kowens redundant; a contractor is four hops from DA
mem "DL-RDP-JumpHost" "SG-IT-ServerAdmins,SG-IT-Helpdesk,jchen"
mem "Domain Admins" "svc-backup"                            # service account directly in DA
mem "Backup Operators Legacy" "svc-backup,pmiller"

echo "[seed] finance"
mem "GG_Finance_Users" "sbrennan,rgoldberg,aokafor,mfischer,sgreen"
mem "GG_Finance_Managers" "sbrennan,rgoldberg"
mem "DL-FS-Finance-RW" "GG_Finance_Managers,aokafor,rgoldberg"   # rgoldberg direct + via managers
mem "DL-FS-Finance-RO" "GG_Finance_Users,Finance Team"            # a distribution list granting file access
mem "DL-App-ERP-Users" "GG_Finance_Users,GG_Ops_Dispatch,vkapoor"
mem "DL-App-ERP-Admins" "vkapoor,svc-erp,mfischer"               # consultant and an AP clerk are ERP admins
mem "Finance Team" "sbrennan,rgoldberg,aokafor,mfischer"

echo "[seed] engineering"
mem "GG_Eng_Developers" "pkumar,bwilliams,hyamamoto,ojensen,cmoreau"
mem "GG_Eng_Leads" "lsantos,pkumar"
mem "DL-FS-Engineering-RW" "GG_Eng_Developers,GG_Eng_Leads"
mem "DL-SQL-Prod-Readers" "GG_Eng_Developers,svc-monitor,bwilliams"   # bwilliams redundant
mem "Engineering" "lsantos,pkumar,bwilliams,hyamamoto,ojensen,cmoreau"

echo "[seed] the rest of the business"
mem "GG_Sales_Team" "gthompson,nali,rvanderberg"
mem "GG_HR_Staff" "eharris,jkim"
mem "DL-FS-HR-Confidential" "GG_HR_Staff,Old_Exchange_Users"         # legacy group still on a confidential share
mem "GG_Ops_Dispatch" "fdiallo,wbecker,lmartin"
mem "GG_Warehouse_Staff" "arossi,dbrown,ikowalski"
mem "DL-App-WMS-Users" "GG_Warehouse_Staff,GG_Ops_Dispatch,arossi"   # arossi redundant
mem "DL-Print-Chicago" "GG_Finance_Users,GG_Eng_Developers,GG_Sales_Team,GG_HR_Staff,svc-scanner"
mem "DL-Print-Rotterdam" "GG_Ops_Dispatch,GG_Warehouse_Staff"
mem "VPN Users" "GG_Eng_Developers,GG_Sales_Team,SG-IT-Helpdesk,Contractors-All,pmiller"
mem "Contractors-All" "vkapoor,ext.jbauer,ext.mliu"
mem "All Employees" "GG_Finance_Users,GG_Eng_Developers,GG_Sales_Team,GG_HR_Staff,GG_Ops_Dispatch,GG_Warehouse_Staff,SG-IT-Helpdesk"
mem "Chicago Office" "mrodriguez,jchen,sbrennan,rgoldberg,lsantos,gthompson,eharris"

echo "[seed] legacy tangle — deep chain and a loop from the migration"
mem "FS01_Share_Users" "Old_Exchange_Users,ext.mliu,sgreen"
mem "FS01_Share_Admins" "FS01_Share_Users"
mem "Citrix_Users_2016" "FS01_Share_Admins,svc-citrix"
mem "Citrix_Admins_2016" "Citrix_Users_2016"
mem "Acme_Migration_Temp" "Citrix_Admins_2016,vkapoor"
mem "Old_Exchange_Users" "Acme_Migration_Temp"                       # closes a loop through five legacy groups
mem "Project Meridian" "Acme_Migration_Temp,pkumar,ojensen"

echo "[seed] disabled accounts that were never cleaned up"
st user disable pmiller; st user disable sgreen; st user disable svc-citrix; st user disable ext.mliu

echo "[seed] real logons for current staff (everyone else reads as never-logged-on)"
for u in mrodriguez jchen dpatel tnguyen kowens sbrennan rgoldberg aokafor mfischer lsantos pkumar bwilliams hyamamoto ojensen cmoreau gthompson nali rvanderberg eharris jkim fdiallo wbecker lmartin arossi dbrown ikowalski vkapoor svc-backup svc-sql-prod svc-erp svc-monitor; do
  smbclient -L 127.0.0.1 -U "$u%$PW" >/dev/null 2>&1 || true
done

echo "[seed] done — $(samba-tool user list | wc -l) users, $(samba-tool group list | wc -l) groups, $(samba-tool computer list | wc -l) computers"
