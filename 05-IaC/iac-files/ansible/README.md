# Ansible Usage Guide

This folder contains Ansible configuration and playbooks for automating tasks on remote servers.

## Folder Structure

- `ansible.cfg` — Ansible configuration file (optional, can be used to set defaults).
- `hosts` — Inventory file listing target hosts and groups.
- `commands.sh` — Example shell commands for common Ansible operations.
- `playbook-createfile.yml` — Sample playbook to create a file on remote hosts.
- `playbook.yaml` — (Add your own playbooks here.)

## File Locations

- Place all Ansible-related files in this `ansible/` directory.
- The inventory file (`hosts`) should be in this folder and referenced with `-i hosts` in commands.  
  If the file is located in `/etc/ansible/hosts` (the default location), it does not need to be referenced with `-i hosts`.
- A `hosts` file in the current folder is **not** picked up automatically. Either use `-i hosts`, or add
  `inventory = hosts` (on its own line, no trailing comment) under `[defaults]` in `ansible.cfg`.
- Check which inventory Ansible sees with `ansible all --list-hosts` or `ansible-inventory --graph`.
- Playbooks (`*.yml`) should also be in this folder.
- The `ansible.cfg` file can be placed in:
  - The current working directory (recommended for project-specific settings)
  - The user's home directory as `~/.ansible.cfg`
  - `/etc/ansible/ansible.cfg` for system-wide settings

## Usage

1. **List all hosts in inventory:**
   ```sh
   ansible all -i hosts --list-hosts
   ```

2. **Ping all hosts:**
   ```sh
   ansible all -i hosts -m ping
   ```

3. **Run a command on hosts in the `[mycloudvms]` group:**
   ```sh
   ansible mycloudvms -i hosts -a "cat /etc/os-release"
   ```

4. **Run a playbook:**
   ```sh
   ansible-playbook -i hosts playbook-createfile.yml
   ```

## Inventory Example

See [`hosts`](hosts) for an example inventory file. Update it with your server IPs and credentials.

## Notes

- Ensure you have Ansible installed (`pip install ansible`).
- Update credentials and hostnames in the inventory file as needed.
- You can add more playbooks to this folder and run them using `ansible-playbook`.
