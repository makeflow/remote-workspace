import {Avatar, List, Popconfirm, message} from 'antd';
import classNames from 'classnames';
import _ from 'lodash';
import md5 from 'md5';
import {observable} from 'mobx';
import {Observer, observer} from 'mobx-react';
import React, {Component, Fragment, ReactNode} from 'react';

import {
  WorkspaceMetadata,
  WorkspaceProjectWithPullMergeRequestInfo,
  WorkspaceStatus,
  WorkspaceStatusWithPullMergeRequestInfo,
  groupWorkspaceProjectConfigs,
} from '../../../bld/shared';

const REFRESH_INTERVAL_DEFAULT = 10000;

export type WorkspaceFilter = (
  workspace: WorkspaceStatusWithPullMergeRequestInfo,
) => boolean;

export interface WorkspaceListProps {
  editingWorkspace: WorkspaceMetadata | undefined;
  all: boolean;
  filter?: WorkspaceFilter;
  onEditClick?(workspace: WorkspaceMetadata): void;
}

@observer
export class WorkspaceList extends Component<WorkspaceListProps> {
  private timer: number | undefined;

  @observable
  private _workspaces: WorkspaceStatusWithPullMergeRequestInfo[] = [];

  @observable
  private tunnelWorkspaceId: string | undefined;

  @observable
  private loading = true;

  private get workspaces(): WorkspaceStatusWithPullMergeRequestInfo[] {
    let {all, filter} = this.props;

    let workspaces = this._workspaces.filter(workspace =>
      filter ? filter(workspace) : true,
    );

    if (all) {
      return workspaces;
    }

    let owner = localStorage.email;

    return workspaces.filter(workspace => workspace.owner === owner);
  }

  render(): ReactNode {
    return (
      <List
        dataSource={this.workspaces}
        loading={this.loading}
        renderItem={workspace => {
          let {projects} = workspace;

          return (
            <Observer>
              {() => (
                <List.Item actions={this.renderActions(workspace)}>
                  <List.Item.Meta
                    className={classNames('workspace-list-item-meta', {
                      ready: workspace.ready,
                    })}
                    avatar={
                      <Avatar
                        src={`https://www.gravatar.com/avatar/${md5(
                          workspace.owner || '',
                        )}?size=64`}
                      />
                    }
                    title={
                      (workspace.displayName || workspace.id) +
                      (workspace.active
                        ? ` [${workspace.outdatedTime}]`
                        : ' [stopped]')
                    }
                    description={
                      projects.length ? (
                        _.flatMap(projects, (project, index) =>
                          this.renderProject(
                            workspace,
                            project,
                            index,
                            projects,
                          ),
                        )
                      ) : (
                        <span>-</span>
                      )
                    }
                  ></List.Item.Meta>
                </List.Item>
              )}
            </Observer>
          );
        }}
      />
    );
  }

  componentDidMount(): void {
    this.refresh();

    this.timer = setInterval(() => this.refresh(), REFRESH_INTERVAL_DEFAULT);
  }

  componentWillUnmount(): void {
    clearInterval(this.timer);
  }

  refresh(): void {
    this._refresh().catch(console.error);
  }

  private renderActions(workspace: WorkspaceStatus): ReactNode[] {
    let {editingWorkspace, onEditClick: _onEditClick} = this.props;

    let editingWorkspaceId = editingWorkspace && editingWorkspace.id;

    let onUpClick = (): void => {
      this.upWorkspaceContainersAndResetOutdatedTime(workspace).catch(
        console.error,
      );
    };

    let onStopClick = (): void => {
      this.stopWorkspaceContainers(workspace).catch(console.error);
    };

    let onTunnelClick = (): void => {
      this.switchTunnel(workspace).catch(console.error);
    };

    let onUntunnelClick = (): void => {
      this.untunnel().catch(console.error);
    };

    let onWorkspaceClick = (): void => {
      this.launch(workspace).catch(console.error);
    };

    let onLogClick = (): void => {
      this.log(workspace.id).catch(console.error);
    };

    let onEditClick =
      _onEditClick &&
      ((): void => {
        _onEditClick!(workspace);
      });

    let onDeleteConfirm = (): void => {
      this.delete(workspace.id).catch(console.error);
    };

    return _.compact([
      workspace.ready && <a onClick={onUpClick}>up</a>,
      workspace.active && <a onClick={onStopClick}>stop</a>,
      workspace.active &&
        (workspace.id === this.tunnelWorkspaceId ? (
          <a onClick={onUntunnelClick}>untunnel</a>
        ) : groupWorkspaceProjectConfigs(workspace).forwards.length ? (
          <a onClick={onTunnelClick}>tunnel</a>
        ) : (
          undefined
        )),
      workspace.active && <a onClick={onWorkspaceClick}>workspace</a>,
      <a onClick={onLogClick}>log</a>,
      _onEditClick ? (
        workspace.id === editingWorkspaceId ? (
          <span>edit</span>
        ) : (
          <a onClick={onEditClick}>edit</a>
        )
      ) : (
        undefined
      ),
      <Popconfirm
        placement="bottom"
        title="Are you sure you want to delete this workspace?"
        onConfirm={onDeleteConfirm}
      >
        <a>delete</a>
      </Popconfirm>,
    ]);
  }

  private renderProject(
    workspace: WorkspaceStatusWithPullMergeRequestInfo,
    {name, git: {pullMergeRequest}}: WorkspaceProjectWithPullMergeRequestInfo,
    index: number,
    projects: WorkspaceProjectWithPullMergeRequestInfo[],
  ): ReactNode {
    return (
      <Fragment key={index}>
        {workspace.active ? (
          <span>
            <a
              className="project-name"
              onClick={() => this.launch(workspace, name)}
            >
              {name}
            </a>
            {pullMergeRequest ? (
              <span className="pull-merge-request">
                (
                <a
                  className={pullMergeRequest.state}
                  href={pullMergeRequest.url}
                >
                  {pullMergeRequest.text}
                </a>
                )
              </span>
            ) : (
              undefined
            )}
          </span>
        ) : (
          <span className="project-name">{name}</span>
        )}
        {index < projects.length - 1 ? <span>, </span> : undefined}
      </Fragment>
    );
  }

  private async _refresh(): Promise<void> {
    let response = await fetch('/api/workspaces');

    let {data} = (await response.json()) as {
      data?: WorkspaceStatusWithPullMergeRequestInfo[];
    };

    if (data) {
      this._workspaces = data;

      if (this.loading) {
        this.loading = false;
      }
    }

    response = await fetch('/api/workspace-id-of-active-tunnel');

    let {data: tunnelWorkspaceId} = (await response.json()) as {
      data?: string;
    };

    if (tunnelWorkspaceId) {
      this.tunnelWorkspaceId = tunnelWorkspaceId;
    }
  }

  private async upWorkspaceContainersAndResetOutdatedTime(
    workspace: WorkspaceStatus,
  ): Promise<void> {
    let response = await fetch(
      `/api/up-and-reset-outdated-time/${workspace.id}`,
    );

    let active = workspace.active;

    let {error} = await response.json();

    if (error) {
      message.error(error);
    } else {
      if (!active) {
        message.success('Workspace containers upped.');
      } else {
        message.success('Workspace outdated time reset.');
      }

      this.refresh();
    }
  }

  private async stopWorkspaceContainers(
    workspace: WorkspaceStatus,
  ): Promise<void> {
    let response = await fetch(`/api/stop/${workspace.id}`);

    let {error, data} = await response.json();

    if (error) {
      message.error(error);
    } else {
      if (data && data.errorMessage) {
        message.error(data.errorMessage);
      } else {
        message.success('Workspace containers stopped.');

        this.refresh();
      }
    }
  }

  private async switchTunnel(workspace: WorkspaceStatus): Promise<void> {
    let response = await fetch('/api/switch-tunnel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspace,
      }),
    });

    let {error} = await response.json();

    if (error) {
      message.error(error);
    } else {
      this.tunnelWorkspaceId = workspace.id;

      message.success('Tunneling...', 0.75);
    }
  }

  private async untunnel(): Promise<void> {
    let response = await fetch('/api/untunnel');

    let {error} = await response.json();

    if (error) {
      message.error(error);
    } else {
      this.tunnelWorkspaceId = undefined;

      message.success('Untunneling...', 0.75);
    }
  }

  private async launch(
    workspace: WorkspaceStatus,
    projectName?: string,
  ): Promise<void> {
    let response = await fetch('/api/launch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspace,
        project: projectName,
      }),
    });

    let {error} = await response.json();

    if (error) {
      message.error(error);
    } else {
      message.loading('Launching VS Code...');
    }
  }

  private async log(id: string): Promise<void> {
    window.open(`/workspaces/${id}/log`);
  }

  private async delete(id: string): Promise<void> {
    let response = await fetch(`/api/workspaces/${id}`, {
      method: 'DELETE',
    });

    let {error} = await response.json();

    if (error) {
      message.error(error);
    } else {
      message.success('Workspace deleted.');

      this.refresh();
    }
  }
}
