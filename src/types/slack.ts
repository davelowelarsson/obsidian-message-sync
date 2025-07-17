// Configuration Types
export interface SlackConfig {
  botToken?: string | undefined;
  appToken?: string | undefined;
  userToken?: string | undefined;
  clientId?: string | undefined;
  clientSecret?: string | undefined;
  redirectUri?: string | undefined;
}

export interface SlackAuthOptions {
  type: 'user' | 'bot';
  scopes: string[];
}

export interface SlackOAuthResponse {
  access_token: string;
  token_type: string;
  scope: string;
  bot_user_id?: string;
  app_id?: string;
  team?: {
    id: string;
    name: string;
  };
  enterprise?: {
    id: string;
    name: string;
  };
  authed_user?: {
    id: string;
    scope: string;
    access_token: string;
    token_type: string;
  };
}

export interface SlackOAuthTokenInfo {
  ok: boolean;
  url: string;
  team: string;
  user: string;
  team_id: string;
  user_id: string;
  scope: string;
  date_created: number;
  date_expires?: number;
  error?: string;
}

// Slack API Response Types
export interface SlackMessage {
  type: string;
  ts: string;
  user?: string;
  text?: string;
  thread_ts?: string;
  reply_count?: number;
  replies?: SlackMessage[];
  bot_id?: string;
  app_id?: string;
  username?: string;
  icons?: {
    emoji?: string;
    image_36?: string;
    image_48?: string;
    image_72?: string;
  };
  attachments?: SlackAttachment[];
  files?: SlackFile[];
  blocks?: SlackBlock[];
  reactions?: SlackReaction[];
  edited?: {
    user: string;
    ts: string;
  };
  permalink?: string;
}

export interface SlackChannel {
  id: string;
  name?: string;
  is_channel?: boolean;
  is_group?: boolean;
  is_im?: boolean;
  is_mpim?: boolean;
  is_private?: boolean;
  is_archived?: boolean;
  is_general?: boolean;
  is_shared?: boolean;
  is_org_shared?: boolean;
  is_pending_ext_shared?: boolean;
  is_ext_shared?: boolean;
  is_member?: boolean;
  created?: number;
  creator?: string;
  topic?: {
    value: string;
    creator: string;
    last_set: number;
  };
  purpose?: {
    value: string;
    creator: string;
    last_set: number;
  };
  num_members?: number;
  locale?: string;
}

export interface SlackUser {
  id: string;
  name?: string;
  real_name?: string;
  display_name?: string;
  email?: string;
  is_bot?: boolean;
  is_admin?: boolean;
  is_owner?: boolean;
  is_primary_owner?: boolean;
  is_restricted?: boolean;
  is_ultra_restricted?: boolean;
  profile?: {
    title?: string;
    phone?: string;
    skype?: string;
    real_name?: string;
    real_name_normalized?: string;
    display_name?: string;
    display_name_normalized?: string;
    email?: string;
    image_24?: string;
    image_32?: string;
    image_48?: string;
    image_72?: string;
    image_192?: string;
    image_512?: string;
    image_1024?: string;
    image_original?: string;
    avatar_hash?: string;
    status_text?: string;
    status_emoji?: string;
  };
  team_id?: string;
  tz?: string;
  tz_label?: string;
  tz_offset?: number;
}

export interface SlackAttachment {
  id?: number;
  color?: string;
  fallback?: string;
  title?: string;
  title_link?: string;
  text?: string;
  pretext?: string;
  author_name?: string;
  author_link?: string;
  author_icon?: string;
  thumb_url?: string;
  image_url?: string;
  image_width?: number;
  image_height?: number;
  footer?: string;
  footer_icon?: string;
  ts?: string;
  fields?: SlackAttachmentField[];
  actions?: SlackAttachmentAction[];
}

interface SlackAttachmentField {
  title: string;
  value: string;
  short?: boolean;
}

interface SlackAttachmentAction {
  type: string;
  text: string;
  url?: string;
  style?: string;
}

export interface SlackFile {
  id: string;
  name?: string;
  title?: string;
  mimetype?: string;
  filetype?: string;
  pretty_type?: string;
  user?: string;
  editable?: boolean;
  size?: number;
  mode?: string;
  is_external?: boolean;
  external_type?: string;
  is_public?: boolean;
  public_url_shared?: boolean;
  display_as_bot?: boolean;
  username?: string;
  url_private?: string;
  url_private_download?: string;
  permalink?: string;
  permalink_public?: string;
  thumb_64?: string;
  thumb_80?: string;
  thumb_360?: string;
  thumb_360_w?: number;
  thumb_360_h?: number;
  thumb_480?: string;
  thumb_480_w?: number;
  thumb_480_h?: number;
  thumb_160?: string;
  thumb_720?: string;
  thumb_720_w?: number;
  thumb_720_h?: number;
  thumb_800?: string;
  thumb_800_w?: number;
  thumb_800_h?: number;
  thumb_960?: string;
  thumb_960_w?: number;
  thumb_960_h?: number;
  thumb_1024?: string;
  thumb_1024_w?: number;
  thumb_1024_h?: number;
  image_exif_rotation?: number;
  original_w?: number;
  original_h?: number;
  preview?: string;
  preview_highlight?: string;
  lines?: number;
  lines_more?: number;
  preview_is_truncated?: boolean;
  comments_count?: number;
  is_starred?: boolean;
  shares?: {
    public?: { [key: string]: SlackFileShare[] };
    private?: { [key: string]: SlackFileShare[] };
  };
  channels?: string[];
  groups?: string[];
  ims?: string[];
  has_rich_preview?: boolean;
}

interface SlackFileShare {
  reply_users?: string[];
  reply_users_count?: number;
  reply_count?: number;
  ts?: string;
  channel_name?: string;
  team_id?: string;
}

interface SlackBlock {
  type: string;
  block_id?: string;
  text?: SlackBlockText;
  fields?: SlackBlockText[];
  accessory?: SlackBlockElement;
  elements?: SlackBlockElement[];
}

interface SlackBlockText {
  type: 'plain_text' | 'mrkdwn';
  text: string;
  emoji?: boolean;
  verbatim?: boolean;
}

interface SlackBlockElement {
  type: string;
  text?: SlackBlockText;
  url?: string;
  value?: string;
  action_id?: string;
  placeholder?: SlackBlockText;
  options?: SlackBlockOption[];
  initial_option?: SlackBlockOption;
  confirm?: SlackBlockConfirm;
  style?: string;
}

interface SlackBlockOption {
  text: SlackBlockText;
  value: string;
  description?: SlackBlockText;
  url?: string;
}

interface SlackBlockConfirm {
  title: SlackBlockText;
  text: SlackBlockText;
  confirm: SlackBlockText;
  deny: SlackBlockText;
  style?: string;
}

export interface SlackReaction {
  name: string;
  users: string[];
  count: number;
}

// Note: Types are exported from index files for external use
