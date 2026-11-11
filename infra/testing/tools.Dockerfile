FROM restic/restic:0.19.1 AS restic
FROM docker:29.7.2-cli
RUN apk add --no-cache bash util-linux tar
COPY --from=restic /usr/bin/restic /usr/local/bin/restic
WORKDIR /workspace
ENTRYPOINT []
CMD ["bash"]
