#list all hosts in the hosts inventory
ansible all --list-hosts

#ping all hosts in the hosts inventory 
ansible all -m ping

#exectue linux commands on the hosts in the [mycloudvms] inventory
ansible mycloudvms -a "cat /etc/os-release"

#reboot all linux hosts in the [linux] inventory
ansible linux -a "reboot"

#run the playbook-createfile.yaml playbook
ansible-playbook playbook-createfile.yml

#run playbook in ubuntu64 servers from local hosts file with max verbosity
ansible-playbook -i hosts playbook-install-nvim-ubuntuAMD64.yaml -vvvv