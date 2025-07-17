---
mode: 'agent'
tools: ['changes', 'codebase', 'editFiles', 'extensions', 'fetch', 'findTestFiles', 'githubRepo', 'new', 'openSimpleBrowser', 'problems', 'readCellOutput', 'runCommands', 'runNotebooks', 'runTasks', 'runTests', 'search', 'searchResults', 'terminalLastCommand', 'terminalSelection', 'testFailure', 'updateUserPreferences', 'usages', 'vscodeAPI', 'context7', 'get-library-docs', 'resolve-library-id', 'memory', 'add_observations', 'add_observations', 'create_entities', 'create_entities', 'create_relations', 'create_relations', 'delete_entities', 'delete_entities', 'delete_observations', 'delete_observations', 'open_nodes', 'open_nodes', 'read_graph', 'read_graph', 'search_nodes', 'search_nodes', 'task-master-ai', 'add_dependency', 'add_subtask', 'add_tag', 'add_task', 'analyze_project_complexity', 'clear_subtasks', 'complexity_report', 'copy_tag', 'delete_tag', 'expand_all', 'expand_task', 'fix_dependencies', 'generate', 'get_task', 'get_tasks', 'list_tags', 'models', 'move_task', 'next_task', 'parse_prd', 'remove_dependency', 'remove_subtask', 'remove_task', 'rename_tag', 'research', 'response-language', 'rules', 'set_task_status', 'update', 'update_subtask', 'update_task', 'use_tag', 'validate_dependencies', 'github', 'list_tags', 'task-master-ai', 'add_dependency', 'add_subtask', 'add_tag', 'add_task', 'analyze_project_complexity', 'clear_subtasks', 'complexity_report', 'copy_tag', 'delete_tag', 'expand_all', 'expand_task', 'fix_dependencies', 'generate', 'get_task', 'get_tasks', 'list_tags', 'models', 'move_task', 'next_task', 'parse_prd', 'remove_dependency', 'remove_subtask', 'remove_task', 'rename_tag', 'research', 'response-language', 'rules', 'set_task_status', 'update', 'update_subtask', 'update_task', 'use_tag', 'validate_dependencies']
description: 'Full development and task execution workflow'
---

# start a new session

start a new session with the following context:

.github/instructions/biome_standards.md
.github/instructions/configuration_management.md
.github/instructions/dev_workflow.md
.github/instructions/self_improve.md
.github/instructions/taskmaster.md
.github/instructions/testing_standards.md
.github/instructions/typescript_development.md
.github/instructions/vscode_rules.md

check memory for any previous context

Then run task-master-ai "next_task" to get the next task to work on.