<script lang="ts">
  let {
    src,
    class: className = '',
    size = 20,
    title
  }: {
    src: string;
    class?: string;
    size?: number;
    title?: string;
  } = $props();
</script>

<span
  class={className}
  role={title ? 'img' : 'presentation'}
  aria-label={title}
  aria-hidden={title ? undefined : true}
  title={title}
  style={`width:${size}px;height:${size}px;display:inline-block;background-color:currentColor;mask:url(${src}) center/contain no-repeat;-webkit-mask:url(${src}) center/contain no-repeat;`}
></span>
